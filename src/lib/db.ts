/**
 * IndexedDB layer for AgentSpec project persistence
 * Implements PRD Section 31: Local Project Persistence
 */

const DB_NAME = 'agentspec-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export interface ProjectData {
  id: string;
  name: string;
  summary: string;
  platform: string[];
  users: string[];
  roles: string[];
  features: any[];
  requirements: string[];
  constraints: string[];
  nonGoals: string[];
  technicalPreferences: {
    frontend: string;
    backend: string;
    database: string;
    realtime: string;
  };
  implementationStrategy: 'frontend-first' | 'module-first';
  createdAt: number;
  updatedAt: number;
}

export interface ClarificationData {
  idea: string;
  questions: Array<{
    id: string;
    question: string;
    description: string;
    type: 'radio' | 'checkbox' | 'text';
    options?: string[];
  }>;
  answers: Array<{
    questionId: string;
    answer: string;
    type: 'radio' | 'checkbox' | 'text';
  }>;
}

export interface GeneratedContent {
  prdContent: string;
  architectureData: any;
  agentInstructions: string;
  features: any[];
  tasks: any[];
}

class IndexedDBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      return; // SSR - skip IndexedDB initialization
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create projects store with id as keyPath
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  async saveProject(project: ProjectData): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(project);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProject(id: string): Promise<ProjectData | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllProjects(): Promise<ProjectData[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const projects = request.result;
        // Sort by createdAt descending
        projects.sort((a, b) => b.createdAt - a.createdAt);
        resolve(projects);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateProject(id: string, updates: Partial<ProjectData>): Promise<void> {
    const project = await this.getProject(id);
    if (!project) throw new Error('Project not found');
    
    const updated = {
      ...project,
      ...updates,
      id,
      updatedAt: Date.now()
    };
    
    await this.saveProject(updated);
  }
}

export const db = new IndexedDBService();
