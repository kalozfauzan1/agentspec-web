import { create } from 'zustand';
import { db, type ProjectData } from './db';

// Initialize DB on import (only in browser)
if (typeof window !== 'undefined') {
  db.init().catch(console.error);
}

export interface ClarificationAnswer {
  questionId: string;
  answer: string;
  type: 'radio' | 'checkbox' | 'text';
}

export interface Feature {
  id: string;
  name: string;
  purpose: string;
  actors: string[];
  mainFlow: string[];
  requirements: string[];
  businessRules: string[];
  edgeCases: string[];
  acceptanceCriteria: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'frontend' | 'backend' | 'integration';
  featureId: string;
  dependencies: string[];
  references: string[];
  requirements: string[];
  acceptanceCriteria: string[];
  status?: 'pending' | 'in-progress' | 'completed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  phase?: string;
  optional?: boolean;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  description: string;
  type: 'radio' | 'checkbox' | 'text';
  options?: string[];
}

export interface ProjectDefinition extends Omit<ProjectData, 'features' | 'requirements' | 'constraints' | 'nonGoals'> {
  features: Feature[];
  requirements: string[];
  constraints: string[];
  nonGoals: string[];
  techStack?: {
    frontend: string;
    backend: string;
    database: string;
    realtime: string;
  };
}

function archValueToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item : archValueToString(item))).join(', ');
  }
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.name === 'string' && o.name) return o.name;
    if (typeof o.recommended === 'string' && o.recommended) return o.recommended;
    if (typeof o.userSelected === 'string' && o.userSelected) return o.userSelected;
    return '-';
  }
  if (value == null) return '';
  return String(value);
}

export interface AppState {
  // Current project state
  currentProject: ProjectDefinition | null;
  recentProjects: ProjectDefinition[];
  
  // Clarification state
  currentIdea: string;
  clarificationQuestions: ClarificationQuestion[];
  clarificationAnswers: ClarificationAnswer[];
  isClarificationComplete: boolean;
  dynamicClarificationQuestions: ClarificationQuestion[];
  
  // Generation state
  isGenerating: boolean;
  generationProgress: number;
  generationStep: string;
  generationError: string | null;
  generationWarnings: string[];
  
  // Generated content
  prdContent: string;
  architectureData: any;
  agentInstructions: string;
  tasks: Task[];
  features: Feature[];
  
  // Actions
  initialize: () => Promise<void>;
  setCurrentIdea: (idea: string) => void;
  setClarificationQuestions: (questions: ClarificationQuestion[]) => void;
  setDynamicClarificationQuestions: (questions: ClarificationQuestion[]) => void;
  setClarificationAnswer: (answer: ClarificationAnswer) => void;
  completeClarification: () => void;
  
  // AI Actions
  analyzeIdea: () => Promise<any>;
  generateClarification: () => Promise<void>;
  generateProject: () => Promise<void>;
  editSpecification: (content: string, instruction: string) => Promise<string>;
  
  // Project Management
  saveProject: (project: ProjectDefinition) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loadRecentProjects: () => Promise<void>;
  loadLatestProject: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  currentProject: null,
  recentProjects: [],
  currentIdea: '',
  clarificationQuestions: [],
  clarificationAnswers: [],
  isClarificationComplete: false,
  dynamicClarificationQuestions: [],
  isGenerating: false,
  generationProgress: 0,
  generationStep: '',
  generationError: null,
  generationWarnings: [],
  prdContent: '',
  architectureData: null,
  agentInstructions: '',
  tasks: [],
  features: [],

  initialize: async () => {
    await db.init();
    await get().loadRecentProjects();
  },

  setCurrentIdea: (idea) => set({ currentIdea: idea }),

  setClarificationQuestions: (questions) => set({ clarificationQuestions: questions }),

  setDynamicClarificationQuestions: (questions) => set({ dynamicClarificationQuestions: questions }),

  setClarificationAnswer: (answer) => set((state) => ({
    clarificationAnswers: [
      ...state.clarificationAnswers.filter(a => a.questionId !== answer.questionId),
      answer
    ]
  })),

  completeClarification: () => set({ isClarificationComplete: true }),

  analyzeIdea: async () => {
    const { currentIdea } = get();
    if (!currentIdea.trim()) {
      throw new Error('Please enter a project idea first');
    }
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: currentIdea })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze idea');
    }
    return response.json();
  },

  generateClarification: async () => {
    const { currentIdea } = get();
    if (!currentIdea.trim()) {
      throw new Error('Please enter a project idea first');
    }
    
    set({ isGenerating: true, generationStep: 'Analyzing idea...', generationProgress: 10, generationError: null });
    
    try {
      // First analyze the idea
      const analysisResult = await get().analyzeIdea();
      const analysis = analysisResult.analysis || analysisResult;
      
      set({ generationProgress: 30, generationStep: 'Generating clarification questions...' });
      
      // Then generate questions via API
      const response = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: currentIdea, analysis })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate clarification questions');
      }
      
      const data = await response.json();
      const questions: ClarificationQuestion[] = (data.questions || []).map((q: any) => ({
        id: q.id,
        question: q.question,
        description: q.description || '',
        type: q.type || 'text',
        options: q.options || []
      }));
      
      set({ 
        dynamicClarificationQuestions: questions,
        clarificationQuestions: questions,
        isGenerating: false,
        generationProgress: 100
      });
    } catch (error) {
      set({ 
        isGenerating: false,
        generationError: error instanceof Error ? error.message : 'Failed to generate clarification'
      });
      throw error;
    }
  },

  generateProject: async () => {
    const { currentIdea, clarificationAnswers } = get();
    
    if (!currentIdea.trim()) {
      throw new Error('Please enter a project idea');
    }

    set({ 
      isGenerating: true, 
      generationProgress: 0,
      generationStep: 'Analyzing your idea...',
      generationError: null,
      generationWarnings: []
    });

    try {
      // Step 1: Analyze the idea
      set({ generationProgress: 10, generationStep: 'Analyzing idea with AI...' });
      const analysis = await get().analyzeIdea();
      
      // Step 2: Generate clarification questions and answers combined
      set({ generationProgress: 25, generationStep: 'Processing your answers...' });
      
      // Step 3: Call generate endpoint with all data
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: currentIdea,
          answers: clarificationAnswers,
          analysis: analysis.analysis || analysis,
          strategy: 'frontend-first' as const
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate project');
      }
      
      set({ generationProgress: 50, generationStep: 'Generating PRD...' });
      
      const data = await response.json();

      // Normalize architecture: unwrap nested { architecture: {...} } wrapper into a flat decisions object.
      const rawArchitecture = (data as any)?.architecture;
      const flatArchitecture =
        rawArchitecture &&
        typeof rawArchitecture === 'object' &&
        (rawArchitecture as any).architecture &&
        typeof (rawArchitecture as any).architecture === 'object'
          ? (rawArchitecture as any).architecture
          : rawArchitecture ?? null;

      // Parse features if needed (accept bare array or {features} wrapper)
      let features: Feature[] = [];
      const featuresSource: unknown = Array.isArray(data.features)
        ? data.features
        : data.features &&
          typeof data.features === 'object' &&
          Array.isArray((data.features as { features?: unknown }).features)
        ? (data.features as { features: unknown[] }).features
        : [];
      if (Array.isArray(featuresSource)) {
        features = (featuresSource as any[]).map((f: any) => ({
          id: f.id || f.featureId || `FEATURE-${Math.random().toString(36).substr(2, 9)}`,
          name: f.name || 'Unnamed Feature',
          purpose: f.purpose || '',
          actors: f.actors || [],
          mainFlow: f.mainFlow || [],
          requirements: f.requirements || [],
          businessRules: f.businessRules || [],
          edgeCases: f.edgeCases || [],
          acceptanceCriteria: f.acceptanceCriteria || []
        }));
      }

      // Parse tasks if needed (accept bare array or {tasks} wrapper)
      let tasks: Task[] = [];
      const tasksSource: unknown = Array.isArray(data.tasks)
        ? data.tasks
        : data.tasks &&
          typeof data.tasks === 'object' &&
          Array.isArray((data.tasks as { tasks?: unknown }).tasks)
        ? (data.tasks as { tasks: unknown[] }).tasks
        : [];
      if (Array.isArray(tasksSource)) {
        tasks = (tasksSource as any[]).map((t: any) => ({
          id: t.id || `TASK-${Math.random().toString(36).substr(2, 9)}`,
          title: t.title || 'Untitled Task',
          description: t.description || '',
          type: t.type || 'frontend',
          featureId: t.featureId || '',
          dependencies: t.dependencies || [],
          references: t.references || [],
          requirements: t.requirements || [],
          acceptanceCriteria: t.acceptanceCriteria || [],
          status: t.status || 'pending',
          priority: t.priority || 'medium',
          phase: t.phase || 'General',
          optional: t.optional
        }));
      }

      // Build project definition from generation results
      const projectDefinition = data.projectDefinition || {};
      const project: ProjectDefinition = {
        id: `proj-${Date.now()}`,
        name: projectDefinition.name || currentIdea.split(' ').slice(0, 5).join(' '),
        summary: currentIdea,
        platform: projectDefinition.platform || ['Web'],
        users: projectDefinition.users || clarificationAnswers
          .filter(a => a.questionId === 'users')
          .map(a => a.answer.split(', '))
          .flat() || ['User', 'Admin'],
        roles: projectDefinition.roles || ['User', 'Admin'],
        features,
        requirements: [],
        constraints: projectDefinition.constraints || [],
        nonGoals: projectDefinition.nonGoals || [],
        technicalPreferences: {
          frontend: archValueToString((flatArchitecture as any)?.frontend) || 'Next.js',
          backend: archValueToString((flatArchitecture as any)?.backend) || 'Node.js',
          database: archValueToString((flatArchitecture as any)?.database) || 'PostgreSQL',
          realtime: archValueToString((flatArchitecture as any)?.realtime) || 'WebSocket'
        },
        techStack: {
          frontend: archValueToString((flatArchitecture as any)?.frontend) || 'Next.js',
          backend: archValueToString((flatArchitecture as any)?.backend) || 'Node.js',
          database: archValueToString((flatArchitecture as any)?.database) || 'PostgreSQL',
          realtime: archValueToString((flatArchitecture as any)?.realtime) || 'WebSocket'
        },
        architectureData: flatArchitecture,
        implementationStrategy: projectDefinition.implementationStrategy || 'frontend-first',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      set({
        currentProject: project,
        prdContent: data.prd || '',
        architectureData: flatArchitecture,
        agentInstructions: data.agentInstructions || '',
        tasks,
        features,
        isGenerating: false,
        generationProgress: 100,
        generationStep: 'Complete!',
        generationWarnings: Array.isArray((data as any)?.warnings) ? (data as any).warnings as string[] : []
      });

      // Save to IndexedDB with full generated content
      await db.saveProject({
        ...(project as ProjectData),
        prdContent: data.prd || '',
        architectureData: flatArchitecture,
        generatedFeatures: features,
        generatedTasks: tasks,
        agentInstructions: data.agentInstructions || '',
      });
      
      // Reload recent projects
      await get().loadRecentProjects();

    } catch (error) {
      set({ 
        isGenerating: false,
        generationError: error instanceof Error ? error.message : 'Failed to generate project'
      });
      throw error;
    }
  },

  editSpecification: async (content: string, instruction: string) => {
    const response = await fetch('/api/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, instruction })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to edit specification');
    }
    const data = await response.json();
    return data.content;
  },

  saveProject: async (project) => {
    await db.saveProject(project as ProjectData);
    await get().loadRecentProjects();
  },

  loadProject: async (id) => {
    const project = await db.getProject(id);
    if (!project) throw new Error('Project not found');
    set({
      currentProject: project as ProjectDefinition,
      prdContent: project.prdContent || '',
      architectureData: project.architectureData || null,
      agentInstructions: project.agentInstructions || '',
      tasks: (project.generatedTasks as Task[]) || [],
      features: (project.generatedFeatures as Feature[]) || (project.features as Feature[]) || [],
    });
  },

  deleteProject: async (id) => {
    await db.deleteProject(id);
    const updated = get().recentProjects.filter(p => p.id !== id);
    set({ recentProjects: updated });
  },

  loadRecentProjects: async () => {
    const projects = await db.getAllProjects();
    set({ recentProjects: projects as ProjectDefinition[] });
  },

  loadLatestProject: async () => {
    await get().initialize();
    const { currentProject, recentProjects, loadProject } = get();
    if (!currentProject && recentProjects.length > 0) {
      await loadProject(recentProjects[0].id);
    }
  }
}));
