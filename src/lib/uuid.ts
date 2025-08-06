// Simple UUID v4 compatible function as a fallback for crypto.randomUUID()
function generateUUID(): string {
  // Check if crypto.randomUUID is available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export { generateUUID as randomUUID };

// Simple in-memory storage fallback for localStorage
const memoryStorage: Record<string, string> = {};

export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : memoryStorage[key] || null;
    } catch (e) {
      return memoryStorage[key] || null;
    }
  },
  
  setItem(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      } else {
        memoryStorage[key] = value;
      }
    } catch (e) {
      memoryStorage[key] = value;
    }
  },
  
  removeItem(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      } else {
        delete memoryStorage[key];
      }
    } catch (e) {
      delete memoryStorage[key];
    }
  },
  
  clear(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      } else {
        Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
      }
    } catch (e) {
      Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
    }
  }
};
