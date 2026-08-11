/**
 * AppState - Immutable state management with reducer pattern
 */

/**
 * Deep clone utility for immutability
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Uint8Array) {
    return new Uint8Array(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * Create an action object
 */
export function createAction(type, payload) {
  return { type, payload };
}

/**
 * AppState class implementing immutable state management
 */
export class AppState {
  constructor() {
    // Initialize default state
    this.state = {
      pdf: { bytes: null, fileName: '', numPages: 0, doc: null },
      stamps: [],
      currentPage: 1,
      currentStampId: null,
      ui: { isDarkMode: this.loadDarkModePreference(), isPreviewMode: false },
      zoom: { scale: 1, panX: 0, panY: 0 }
    };

    // Subscribers list
    this.subscribers = [];
  }

  /**
   * Load dark mode preference from localStorage
   */
  loadDarkModePreference() {
    const saved = localStorage.getItem('qr-stamp:isDarkMode');
    return saved === 'true';
  }

  /**
   * Get current state as a deep clone
   */
  getCurrentState() {
    return deepClone(this.state);
  }

  /**
   * Reducer function to handle actions
   */
  reducer(state, action) {
    const { type, payload } = action;

    switch (type) {
      case 'SET_PDF':
        return {
          ...state,
          pdf: deepClone(payload)
        };

      case 'SET_CURRENT_PAGE':
        return {
          ...state,
          currentPage: payload
        };

      case 'ADD_STAMP': {
        const newStamps = [...state.stamps, deepClone(payload)];
        return {
          ...state,
          stamps: newStamps
        };
      }

      case 'UPDATE_STAMP': {
        const { id, ...updates } = payload;
        const newStamps = state.stamps.map(stamp =>
          stamp.id === id ? { ...stamp, ...updates } : stamp
        );
        return {
          ...state,
          stamps: newStamps
        };
      }

      case 'DELETE_STAMP': {
        const stampIdToDelete = payload;
        const newStamps = state.stamps.filter(stamp => stamp.id !== stampIdToDelete);
        return {
          ...state,
          stamps: newStamps
        };
      }

      case 'SET_DARK_MODE':
        localStorage.setItem('qr-stamp:isDarkMode', payload ? 'true' : 'false');
        return {
          ...state,
          ui: {
            ...state.ui,
            isDarkMode: payload
          }
        };

      case 'SET_ZOOM':
        return {
          ...state,
          zoom: deepClone(payload)
        };

      case 'CLEAR_STAMPS':
        return {
          ...state,
          stamps: []
        };

      case 'SET_CURRENT_STAMP':
        return {
          ...state,
          currentStampId: payload
        };

      default:
        return state;
    }
  }

  /**
   * Dispatch an action
   */
  dispatch(action) {
    this.state = this.reducer(this.state, action);
    this.notifySubscribers();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback) {
    this.subscribers.push(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  /**
   * Notify all subscribers of state change
   */
  notifySubscribers() {
    const currentState = this.getCurrentState();
    this.subscribers.forEach(callback => {
      callback(currentState);
    });
  }

  /**
   * Selector: Get all stamps
   */
  selectStamps() {
    return deepClone(this.state.stamps);
  }

  /**
   * Selector: Get current stamp
   */
  selectCurrentStamp() {
    const stamp = this.state.stamps.find(s => s.id === this.state.currentStampId);
    return stamp ? deepClone(stamp) : null;
  }

  /**
   * Selector: Get PDF data
   */
  selectPdf() {
    return deepClone(this.state.pdf);
  }

  /**
   * Selector: Get dark mode state
   */
  selectDarkMode() {
    return this.state.ui.isDarkMode;
  }

  /**
   * Selector: Get zoom state
   */
  selectZoom() {
    return deepClone(this.state.zoom);
  }
}

// Singleton instance
let appStateInstance = null;

/**
 * Get singleton AppState instance
 */
export function getAppState() {
  if (!appStateInstance) {
    appStateInstance = new AppState();
  }
  return appStateInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetAppState() {
  appStateInstance = null;
}
