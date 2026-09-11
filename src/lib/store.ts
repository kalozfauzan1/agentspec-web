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
      generationError: null
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

      // Parse features if needed
      let features: Feature[] = [];
      if (Array.isArray(data.features)) {
        features = data.features.map((f: any) => ({
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

      // Parse tasks if needed
      let tasks: Task[] = [];
      if (Array.isArray(data.tasks)) {
        tasks = data.tasks.map((t: any) => ({
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
          phase: t.phase || 'General'
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
          frontend: data.architecture?.frontend || 'Next.js',
          backend: data.architecture?.backend || 'Node.js',
          database: data.architecture?.database || 'PostgreSQL',
          realtime: data.architecture?.realtime || 'WebSocket'
        },
        techStack: {
          frontend: data.architecture?.frontend || 'Next.js',
          backend: data.architecture?.backend || 'Node.js',
          database: data.architecture?.database || 'PostgreSQL',
          realtime: data.architecture?.realtime || 'WebSocket'
        },
        implementationStrategy: projectDefinition.implementationStrategy || 'frontend-first',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      set({
        currentProject: project,
        prdContent: data.prd || '',
        architectureData: data.architecture || null,
        agentInstructions: data.agentInstructions || '',
        tasks,
        features,
        isGenerating: false,
        generationProgress: 100,
        generationStep: 'Complete!'
      });

      // Save to IndexedDB
      await db.saveProject(project as ProjectData);
      
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
    set({ currentProject: project as ProjectDefinition });
  },

  deleteProject: async (id) => {
    await db.deleteProject(id);
    const updated = get().recentProjects.filter(p => p.id !== id);
    set({ recentProjects: updated });
  },

  loadRecentProjects: async () => {
    const projects = await db.getAllProjects();
    set({ recentProjects: projects as ProjectDefinition[] });
  }
}));
