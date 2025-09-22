/**
 * 简化的项目服务 - 使用统一认证系统
 */

import { supabase, authService } from './auth';
import { ComicStyle } from './types/comic';

export interface Project {
  id: string;
  name: string;
  description: string;
  style: ComicStyle;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  style: ComicStyle;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  style?: ComicStyle;
}

export class ProjectService {
  private static instance: ProjectService;

  private constructor() {}

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  /**
   * 创建新项目
   */
  async createProject(data: CreateProjectData): Promise<Project> {
    try {
      // 确保用户已认证
      const user = await authService.ensureAuthenticated();
      
      const projectData = {
        id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: data.name,
        description: data.description || '',
        style: data.style,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('📝 Creating project:', projectData.name);

      const { data: project, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create project: ${error.message}`);
      }

      console.log('✅ Project created:', project.id);
      return this.mapProject(project);

    } catch (error) {
      console.error('❌ Create project failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有项目
   */
  async getProjects(): Promise<Project[]> {
    try {
      // 确保用户已认证
      const user = await authService.ensureAuthenticated();

      console.log('📋 Getting projects for user:', user.id);

      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get projects: ${error.message}`);
      }

      console.log('✅ Found projects:', projects?.length || 0);
      return projects?.map(this.mapProject) || [];

    } catch (error) {
      console.error('❌ Get projects failed:', error);
      throw error;
    }
  }

  /**
   * 获取单个项目
   */
  async getProject(projectId: string): Promise<Project | null> {
    try {
      // 确保用户已认证
      const user = await authService.ensureAuthenticated();

      console.log('📄 Getting project:', projectId);

      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('❌ Project not found:', projectId);
          return null;
        }
        throw new Error(`Failed to get project: ${error.message}`);
      }

      console.log('✅ Project found:', project.name);
      return this.mapProject(project);

    } catch (error) {
      console.error('❌ Get project failed:', error);
      throw error;
    }
  }

  /**
   * 更新项目
   */
  async updateProject(projectId: string, data: UpdateProjectData): Promise<Project> {
    try {
      // 确保用户已认证
      const user = await authService.ensureAuthenticated();

      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      console.log('📝 Updating project:', projectId);

      const { data: project, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update project: ${error.message}`);
      }

      console.log('✅ Project updated:', project.id);
      return this.mapProject(project);

    } catch (error) {
      console.error('❌ Update project failed:', error);
      throw error;
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      // 确保用户已认证
      const user = await authService.ensureAuthenticated();

      console.log('🗑️ Deleting project:', projectId);

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(`Failed to delete project: ${error.message}`);
      }

      console.log('✅ Project deleted:', projectId);

    } catch (error) {
      console.error('❌ Delete project failed:', error);
      throw error;
    }
  }

  /**
   * 将数据库记录映射为 Project 对象
   */
  private mapProject(data: any): Project {
    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      style: data.style,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      userId: data.user_id,
    };
  }
}

// 导出单例实例
export const projectService = ProjectService.getInstance();
