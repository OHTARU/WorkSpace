'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Folder,
  Calendar,
  GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Project, Todo, TodoPeriod } from '@shared/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { usePagination } from '@/hooks/usePagination';
import { useSubscription } from '@/hooks/useSubscription';
import { Pagination } from '@/components/Pagination';
import { SkeletonProject, SkeletonList } from '@/components/Skeleton';
import { Modal } from '@/components/Modal';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { UsageWarningBanner } from '@/components/subscription/UsageWarningBanner';
import { logger } from '@/lib/logger';

const PERIOD_LABELS: Record<TodoPeriod, string> = {
  monthly: '월간',
  weekly: '주간',
  daily: '일간',
};

const PERIOD_COLORS: Record<TodoPeriod, string> = {
  monthly: 'bg-purple-100 text-purple-700',
  weekly: 'bg-blue-100 text-blue-700',
  daily: 'bg-green-100 text-green-700',
};

// 드래그 가능한 Todo 아이템 (메모이제이션 적용)
const SortableTodoItem = memo(function SortableTodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${
        todo.is_completed ? 'opacity-60' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab"
        aria-label="드래그하여 순서 변경"
      >
        <GripVertical size={16} />
      </button>

      <input
        type="checkbox"
        checked={todo.is_completed}
        onChange={() => onToggle(todo.id, todo.is_completed)}
        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        aria-label={`${todo.title} 완료 체크`}
      />

      <div className="flex-1">
        <span className={todo.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}>
          {todo.title}
        </span>
        {todo.target_date && (
          <span className="ml-2 text-xs text-gray-500">
            <Calendar size={12} className="inline mr-1" aria-hidden="true" />
            {todo.target_date}
          </span>
        )}
      </div>

      <span className={`px-2 py-0.5 text-xs rounded-full ${PERIOD_COLORS[todo.period]}`}>
        {PERIOD_LABELS[todo.period]}
      </span>

      <button
        onClick={() => onDelete(todo.id)}
        className="p-1 text-gray-400 hover:text-red-600"
        aria-label={`${todo.title} 삭제`}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
});

export default function TodosPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 폼 상태
  const [projectName, setProjectName] = useState('');
  const [projectColor, setProjectColor] = useState('#3B82F6');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoPeriod, setTodoPeriod] = useState<TodoPeriod>('daily');
  const [todoDate, setTodoDate] = useState('');

  // 구독 제한 상태
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState({ current: 0, limit: 0 });

  const supabase = createClient();
  const pagination = usePagination({ initialPageSize: 10 });
  const { checkLimit, isFree } = useSubscription();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 사용자 확인
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    checkUser();
  }, []);

  // userId나 페이지가 변경되면 데이터 조회
  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId, pagination.page, pagination.pageSize]);

  // Realtime 구독 (에러 핸들링 포함)
  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel;

    const setupRealtime = () => {
      channel = supabase
        .channel('todos-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` }, fetchData)
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            logger.log('Todos realtime connected');
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.error('Todos realtime subscription error:', err);
            // 재연결 시도
            setTimeout(() => {
              supabase.removeChannel(channel);
              setupRealtime();
            }, 5000);
          }
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  const fetchData = async () => {
    if (!userId) return;

    setLoading(true);

    // 프로젝트 총 개수 조회
    const { count: projectCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    pagination.setTotalCount(projectCount || 0);

    // 페이지네이션으로 프로젝트 조회
    const { data: projectsData } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order')
      .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

    if (projectsData) {
      setProjects(projectsData);
      setExpandedProjects(new Set(projectsData.map((p) => p.id)));

      // 현재 페이지의 프로젝트에 속한 todos만 조회
      const projectIds = projectsData.map((p) => p.id);
      if (projectIds.length > 0) {
        const { data: todosData } = await supabase
          .from('todos')
          .select('*')
          .eq('user_id', userId)
          .in('project_id', projectIds)
          .order('sort_order');

        if (todosData) setTodos(todosData);
      } else {
        setTodos([]);
      }
    }

    setLoading(false);
  };

  const addProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // 구독 제한 체크
    const limit = checkLimit('projects');
    if (!limit.allowed) {
      setLimitInfo({ current: limit.current, limit: limit.limit });
      setShowUpgradeModal(true);
      return;
    }

    const { error } = await supabase.from('projects').insert({
      user_id: userId,
      name: projectName,
      color: projectColor,
      sort_order: projects.length,
    });

    if (error) {
      toast.error('프로젝트 추가에 실패했습니다.');
    } else {
      toast.success('프로젝트가 추가되었습니다!');
      setShowProjectModal(false);
      setProjectName('');
    }
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const projectTodos = todos.filter((t) => t.project_id === selectedProjectId);

    const { error } = await supabase.from('todos').insert({
      user_id: userId,
      project_id: selectedProjectId,
      title: todoTitle,
      period: todoPeriod,
      target_date: todoDate || null,
      sort_order: projectTodos.length,
    });

    if (error) {
      toast.error('할일 추가에 실패했습니다.');
    } else {
      toast.success('할일이 추가되었습니다!');
      setShowTodoModal(false);
      setTodoTitle('');
      setTodoDate('');
    }
  };

  const toggleTodo = useCallback(async (id: string, currentState: boolean) => {
    // Optimistic update: 로컬 상태 먼저 업데이트
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              is_completed: !currentState,
              completed_at: !currentState ? new Date().toISOString() : null,
            }
          : todo
      )
    );

    const { error } = await supabase
      .from('todos')
      .update({
        is_completed: !currentState,
        completed_at: !currentState ? new Date().toISOString() : null,
      })
      .eq('id', id);

    if (error) {
      // 실패 시 롤백
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id
            ? {
                ...todo,
                is_completed: currentState,
                completed_at: currentState ? todo.completed_at : null,
              }
            : todo
        )
      );
      toast.error('상태 변경에 실패했습니다.');
    }
  }, []);

  const deleteTodo = useCallback(async (id: string) => {
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) toast.error('삭제에 실패했습니다.');
    else toast.success('삭제되었습니다.');
  }, []);

  const deleteProject = async (id: string) => {
    if (!confirm('프로젝트와 모든 할일이 삭제됩니다. 계속하시겠습니까?')) return;

    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) toast.error('삭제에 실패했습니다.');
    else toast.success('프로젝트가 삭제되었습니다.');
  };

  const handleDragEnd = async (event: DragEndEvent, projectId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const projectTodos = todos.filter((t) => t.project_id === projectId);
    const oldIndex = projectTodos.findIndex((t) => t.id === active.id);
    const newIndex = projectTodos.findIndex((t) => t.id === over.id);

    const reordered = arrayMove(projectTodos, oldIndex, newIndex);

    // 로컬 상태 즉시 업데이트
    setTodos((prev) => {
      const otherTodos = prev.filter((t) => t.project_id !== projectId);
      return [...otherTodos, ...reordered];
    });

    // DB 업데이트
    const updates = reordered.map((todo, index) => ({
      id: todo.id,
      sort_order: index,
    }));

    for (const update of updates) {
      await supabase.from('todos').update({ sort_order: update.sort_order }).eq('id', update.id);
    }
  };

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">To-Do 리스트</h1>
          <div className="w-32 h-10 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <SkeletonList count={3}>
          <SkeletonProject />
        </SkeletonList>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">To-Do 리스트</h1>
        <button
          onClick={() => setShowProjectModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          프로젝트 추가
        </button>
      </div>

      {/* 사용량 경고 배너 */}
      {isFree && (
        <UsageWarningBanner
          feature="projects"
          current={checkLimit('projects').current}
          limit={checkLimit('projects').limit}
        />
      )}

      {/* 프로젝트 목록 */}
      <div className="space-y-4">
        {projects.length === 0 ? (
          <div className="card text-center text-gray-500">
            프로젝트가 없습니다. 위의 버튼으로 새 프로젝트를 만들어보세요.
          </div>
        ) : (
          projects.map((project) => {
            const projectTodos = todos.filter((t) => t.project_id === project.id);
            const isExpanded = expandedProjects.has(project.id);
            const completedCount = projectTodos.filter((t) => t.is_completed).length;

            return (
              <div key={project.id} className="card">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                    aria-label={isExpanded ? '프로젝트 접기' : '프로젝트 펼치기'}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>

                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: project.color }}
                  />

                  <Folder size={20} className="text-gray-400" />

                  <h2 className="font-semibold text-gray-900 flex-1">{project.name}</h2>

                  <span className="text-sm text-gray-500">
                    {completedCount}/{projectTodos.length} 완료
                  </span>

                  <button
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setShowTodoModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"
                    aria-label="할일 추가"
                  >
                    <Plus size={20} />
                  </button>

                  <button
                    onClick={() => deleteProject(project.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    aria-label="프로젝트 삭제"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {isExpanded && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(e, project.id)}
                  >
                    <SortableContext
                      items={projectTodos.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 ml-8">
                        {projectTodos.length === 0 ? (
                          <p className="text-sm text-gray-400 py-2">할일이 없습니다.</p>
                        ) : (
                          projectTodos.map((todo) => (
                            <SortableTodoItem
                              key={todo.id}
                              todo={todo}
                              onToggle={toggleTodo}
                              onDelete={deleteTodo}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 페이지네이션 */}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        pageSizeOptions={[5, 10, 20]}
      />

      {/* 프로젝트 추가 모달 */}
      <Modal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        title="새 프로젝트"
        maxWidth="md"
      >
        <form onSubmit={addProject} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              프로젝트명 *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="input"
              placeholder="예: 업무, 개인 프로젝트"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">색상</label>
            <input
              type="color"
              value={projectColor}
              onChange={(e) => setProjectColor(e.target.value)}
              className="w-full h-10 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowProjectModal(false)}
              className="btn btn-secondary flex-1"
            >
              취소
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              생성
            </button>
          </div>
        </form>
      </Modal>

      {/* 할일 추가 모달 */}
      <Modal
        isOpen={showTodoModal}
        onClose={() => {
          setShowTodoModal(false);
          setSelectedProjectId(null);
        }}
        title="새 할일"
        maxWidth="md"
      >
        <form onSubmit={addTodo} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              할일 *
            </label>
            <input
              type="text"
              value={todoTitle}
              onChange={(e) => setTodoTitle(e.target.value)}
              className="input"
              placeholder="할일을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">기간</label>
            <select
              value={todoPeriod}
              onChange={(e) => setTodoPeriod(e.target.value as TodoPeriod)}
              className="input"
            >
              <option value="daily">일간</option>
              <option value="weekly">주간</option>
              <option value="monthly">월간</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">목표 날짜</label>
            <input
              type="date"
              value={todoDate}
              onChange={(e) => setTodoDate(e.target.value)}
              className="input"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowTodoModal(false);
                setSelectedProjectId(null);
              }}
              className="btn btn-secondary flex-1"
            >
              취소
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              추가
            </button>
          </div>
        </form>
      </Modal>

      {/* 업그레이드 모달 */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="projects"
        current={limitInfo.current}
        limit={limitInfo.limit}
      />
    </div>
  );
}
