import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRestart = () => {
    // Reset error state to allow app to recover
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReport = () => {
    const { error, errorInfo } = this.state;
    const deviceHash = Platform.OS + '-' + Platform.Version;
    const timestamp = new Date().toISOString();
    
    const errorDetails = `
--- BUG REPORT ---
Timestamp: ${timestamp}
Device/OS: ${deviceHash}
App Version: 1.0.1 (Build 2)

Error Message:
${error?.toString()}

Component Stack:
${errorInfo?.componentStack}

--- END REPORT ---
`.trim();

    const subject = `[WorkSync Bug Report] ${error?.name || 'Error'}`;
    const url = `mailto:dusckd4948@naver.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(errorDetails)}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('알림', '이메일 앱을 찾을 수 없습니다. dusckd4948@naver.com 으로 오류 내용을 보내주세요.');
      }
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Ionicons name="warning" size={64} color="#EF4444" style={styles.icon} />
            <Text style={styles.title}>오류가 발생했습니다</Text>
            <Text style={styles.subtitle}>
              죄송합니다. 앱 실행 중 예상치 못한 문제가 발생했습니다.
            </Text>
            
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {this.state.error?.toString()}
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
                <Text style={styles.buttonText}>앱 다시 시작</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={this.handleReport}>
                <Text style={styles.secondaryButtonText}>오류 보고하기</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '600',
  },
});
