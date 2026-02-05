import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SectionList,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSubscription } from '../../src/hooks/useSubscription';

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_archived: boolean;
  sort_order: number;
}

interface Todo {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  period: 'monthly' | 'weekly' | 'daily';
  target_date: string | null;
  is_completed: boolean;
  priority: number;
  sort_order: number;
}

const PERIOD_LABELS = {
  monthly: '월간',
  weekly: '주간',
  daily: '일간',
};

const PERIOD_COLORS = {
  monthly: '#8B5CF6',
  weekly: '#3B82F6',
  daily: '#10B981',
};

const PROJECT_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#6366F1',
];

export default function TodosScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { checkLimit } = useSubscription();

  // 프로젝트 모달
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });

  // To-Do 모달
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [todoForm, setTodoForm] = useState({
    title: '',
    description: '',
    period: 'daily' as 'monthly' | 'weekly' | 'daily',
    target_date: '',
    project_id: null as string | null,
  });

  const [saving, setSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
      setupRealtimeSubscription();
    }
  }, [user]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!user) return;

    const channel = supabase
      .channel('todos-mobile')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'todos',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        InteractionManager.runAfterInteractions(() => {
          fetchData();
        });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        InteractionManager.runAfterInteractions(() => {
          fetchData();
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    const [projectsResult, todosResult] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('sort_order'),
      supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order'),
    ]);

    if (projectsResult.data) setProjects(projectsResult.data);
    if (todosResult.data) setTodos(todosResult.data);

    setLoading(false);
    setRefreshing(false);
  };

  const toggleTodo = async (id: string, currentState: boolean) => {
    // 낙관적 업데이트
    setTodos(prev =>
      prev.map(t => t.id === id ? { ...t, is_completed: !currentState } : t)
    );

    await supabase
      .from('todos')
      .update({
        is_completed: !currentState,
        completed_at: !currentState ? new Date().toISOString() : null,
      })
      .eq('id', id);
  };

  // 프로젝트 CRUD
  const openAddProject = () => {
    setEditingProject(null);
    setProjectForm({ name: '', description: '', color: '#3B82F6' });
    setShowProjectModal(true);
    setShowMenu(false);
  };

  const openEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      description: project.description || '',
      color: project.color,
    });
    setShowProjectModal(true);
  };

  const saveProject = async () => {
    if (!user || !projectForm.name.trim()) {
      Alert.alert('오류', '프로젝트 이름을 입력하세요.');
      return;
    }

    // 새 프로젝트 추가 시 구독 제한 체크
    if (!editingProject) {
      const limit = checkLimit('projects');
      if (!limit.allowed) {
        Alert.alert(
          '한도 도달',
          `프로젝트 생성 한도(${limit.limit}개)에 도달했습니다.\n\n웹사이트에서 플랜을 관리할 수 있습니다.`,
          [{ text: '확인', style: 'cancel' }]
        );
        return;
      }
    }

    setSaving(true);

    try {
      if (editingProject) {
        await supabase
          .from('projects')
          .update({
            name: projectForm.name.trim(),
            description: projectForm.description.trim() || null,
            color: projectForm.color,
          })
          .eq('id', editingProject.id);
      } else {
        await supabase.from('projects').insert({
          user_id: user.id,
          name: projectForm.name.trim(),
          description: projectForm.description.trim() || null,
          color: projectForm.color,
          sort_order: projects.length,
        });
      }

      setShowProjectModal(false);
      fetchData();
    } catch (error) {
      Alert.alert('오류', '저장에 실패했습니다.');
    }

    setSaving(false);
  };

  const deleteProject = (project: Project) => {
    Alert.alert(
      '프로젝트 삭제',
      `"${project.name}" 프로젝트와 모든 할일을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('projects').delete().eq('id', project.id);
            fetchData();
          },
        },
      ]
    );
  };

  // To-Do CRUD
  const openAddTodo = (projectId?: string) => {
    setEditingTodo(null);
    setTodoForm({
      title: '',
      description: '',
      period: 'daily',
      target_date: '',
      project_id: projectId || (projects[0]?.id ?? null),
    });
    setShowTodoModal(true);
    setShowMenu(false);
  };

  const openEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
    setTodoForm({
      title: todo.title,
      description: todo.description || '',
      period: todo.period,
      target_date: todo.target_date || '',
      project_id: todo.project_id,
    });
    setShowTodoModal(true);
  };

  const saveTodo = async () => {
    if (!user || !todoForm.title.trim()) {
      Alert.alert('오류', '할일 제목을 입력하세요.');
      return;
    }

    setSaving(true);

    try {
      if (editingTodo) {
        await supabase
          .from('todos')
          .update({
            title: todoForm.title.trim(),
            description: todoForm.description.trim() || null,
            period: todoForm.period,
            target_date: todoForm.target_date || null,
            project_id: todoForm.project_id,
          })
          .eq('id', editingTodo.id);
      } else {
        const projectTodos = todos.filter(t => t.project_id === todoForm.project_id);
        await supabase.from('todos').insert({
          user_id: user.id,
          title: todoForm.title.trim(),
          description: todoForm.description.trim() || null,
          period: todoForm.period,
          target_date: todoForm.target_date || null,
          project_id: todoForm.project_id,
          sort_order: projectTodos.length,
        });
      }

      setShowTodoModal(false);
      fetchData();
    } catch (error) {
      Alert.alert('오류', '저장에 실패했습니다.');
    }

    setSaving(false);
  };

  const deleteTodo = (todo: Todo) => {
    Alert.alert(
      '할일 삭제',
      `"${todo.title}"을(를) 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('todos').delete().eq('id', todo.id);
            fetchData();
          },
        },
      ]
    );
  };

  const sections = projects.map((project) => ({
    project,
    title: project.name,
    color: project.color,
    data: todos.filter((t) => t.project_id === project.id),
  }));

  // 프로젝트 없는 할일
  const unassignedTodos = todos.filter(t => !t.project_id);
  if (unassignedTodos.length > 0) {
    sections.push({
      project: null as any,
      title: '기타',
      color: '#6B7280',
      data: unassignedTodos,
    });
  }

  const renderTodo = ({ item }: { item: Todo }) => (
    <View style={[styles.todoItem, item.is_completed && styles.todoCompleted]}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => toggleTodo(item.id, item.is_completed)}
      >
        <Ionicons
          name={item.is_completed ? 'checkbox' : 'square-outline'}
          size={24}
          color={item.is_completed ? '#10B981' : '#9CA3AF'}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.todoContent}
        onPress={() => openEditTodo(item)}
      >
        <Text style={[styles.todoTitle, item.is_completed && styles.todoTitleCompleted]}>
          {item.title}
        </Text>
        {item.description && (
          <Text style={styles.todoDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        {item.target_date && (
          <Text style={styles.todoDate}>
            <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />{' '}
            {item.target_date}
          </Text>
        )}
      </TouchableOpacity>

      <View style={[styles.periodBadge, { backgroundColor: PERIOD_COLORS[item.period] }]}>
        <Text style={styles.periodText}>{PERIOD_LABELS[item.period]}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteTodo(item)}
      >
        <Ionicons name="trash-outline" size={18} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  const renderSectionHeader = ({ section }: { section: typeof sections[0] }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLeft}>
        <View style={[styles.projectDot, { backgroundColor: section.color }]} />
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>({section.data.length})</Text>
      </View>
      <View style={styles.sectionActions}>
        <TouchableOpacity
          style={styles.sectionButton}
          onPress={() => openAddTodo(section.project?.id)}
        >
          <Ionicons name="add" size={18} color="#3B82F6" />
        </TouchableOpacity>
        {section.project && (
          <>
            <TouchableOpacity
              style={styles.sectionButton}
              onPress={() => openEditProject(section.project)}
            >
              <Ionicons name="pencil" size={16} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sectionButton}
              onPress={() => deleteProject(section.project)}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>할일 목록</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={openAddProject}
          >
            <Ionicons name="folder-open" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => openAddTodo()}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderTodo}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkbox-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>할일이 없습니다</Text>
            <Text style={styles.emptySubtext}>+ 버튼을 눌러 프로젝트와 할일을 추가하세요</Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
      />

      {/* 프로젝트 모달 */}
      <Modal visible={showProjectModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProject ? '프로젝트 수정' : '새 프로젝트'}
              </Text>
              <TouchableOpacity onPress={() => setShowProjectModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.label}>프로젝트 이름 *</Text>
              <TextInput
                style={styles.input}
                placeholder="프로젝트 이름"
                placeholderTextColor="#9CA3AF"
                value={projectForm.name}
                onChangeText={(text) => setProjectForm({ ...projectForm, name: text })}
              />

              <Text style={styles.label}>설명</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="프로젝트 설명"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={projectForm.description}
                onChangeText={(text) => setProjectForm({ ...projectForm, description: text })}
              />

              <Text style={styles.label}>색상</Text>
              <View style={styles.colorPicker}>
                {PROJECT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      projectForm.color === color && styles.colorSelected,
                    ]}
                    onPress={() => setProjectForm({ ...projectForm, color })}
                  >
                    {projectForm.color === color && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowProjectModal(false)}
              >
                <Text style={styles.secondaryButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={saveProject}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? '저장 중...' : '저장'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* To-Do 모달 */}
      <Modal visible={showTodoModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTodo ? '할일 수정' : '새 할일'}
              </Text>
              <TouchableOpacity onPress={() => setShowTodoModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.label}>할일 제목 *</Text>
              <TextInput
                style={styles.input}
                placeholder="할일 제목"
                placeholderTextColor="#9CA3AF"
                value={todoForm.title}
                onChangeText={(text) => setTodoForm({ ...todoForm, title: text })}
              />

              <Text style={styles.label}>설명</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="상세 설명"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={todoForm.description}
                onChangeText={(text) => setTodoForm({ ...todoForm, description: text })}
              />

              <Text style={styles.label}>프로젝트</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectSelector}>
                {projects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={[
                      styles.projectOption,
                      todoForm.project_id === project.id && {
                        backgroundColor: project.color,
                        borderColor: project.color,
                      },
                    ]}
                    onPress={() => setTodoForm({ ...todoForm, project_id: project.id })}
                  >
                    <Text
                      style={[
                        styles.projectOptionText,
                        todoForm.project_id === project.id && { color: '#fff' },
                      ]}
                    >
                      {project.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>기간</Text>
              <View style={styles.periodSelector}>
                {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                  <TouchableOpacity
                    key={period}
                    style={[
                      styles.periodOption,
                      todoForm.period === period && {
                        backgroundColor: PERIOD_COLORS[period],
                        borderColor: PERIOD_COLORS[period],
                      },
                    ]}
                    onPress={() => setTodoForm({ ...todoForm, period })}
                  >
                    <Text
                      style={[
                        styles.periodOptionText,
                        todoForm.period === period && { color: '#fff' },
                      ]}
                    >
                      {PERIOD_LABELS[period]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>목표 날짜</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                value={todoForm.target_date}
                onChangeText={(text) => setTodoForm({ ...todoForm, target_date: text })}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowTodoModal(false)}
              >
                <Text style={styles.secondaryButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={saveTodo}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? '저장 중...' : '저장'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 8,
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 4,
  },
  sectionButton: {
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  projectDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionCount: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  todoItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  todoCompleted: {
    opacity: 0.6,
  },
  checkbox: {
    padding: 2,
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 15,
    color: '#1F2937',
  },
  todoTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  todoDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  todoDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  periodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  periodText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    width: '92%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  projectSelector: {
    marginTop: 8,
  },
  projectOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  projectOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  periodOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  periodOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 14,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 14,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
});
