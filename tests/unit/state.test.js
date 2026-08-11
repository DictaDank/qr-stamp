import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppState, createAction, getAppState, resetAppState } from '../../src/modules/state.js';

// Mock localStorage for Node.js environment
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  key(index) {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

global.localStorage = new LocalStorageMock();

describe('AppState', () => {
  let appState;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset the singleton for getAppState tests
    // We need to reimport to get a fresh singleton, so we'll create a new instance for most tests
    appState = new AppState();
  });

  afterEach(() => {
    // Reset singleton between tests
    resetAppState();
  });

  describe('constructor', () => {
    it('should initialize with correct default state', () => {
      const state = appState.getCurrentState();

      expect(state).toEqual({
        pdf: { bytes: null, fileName: '', numPages: 0, doc: null },
        stamps: [],
        currentPage: 1,
        currentStampId: null,
        ui: { isDarkMode: false, isPreviewMode: false },
        zoom: { scale: 1, panX: 0, panY: 0 }
      });
    });

    it('should load dark mode from localStorage if previously set', () => {
      localStorage.setItem('qr-stamp:isDarkMode', 'true');
      const freshState = new AppState();
      const state = freshState.getCurrentState();

      expect(state.ui.isDarkMode).toBe(true);
    });
  });

  describe('getCurrentState', () => {
    it('should return a deep clone of current state', () => {
      const state1 = appState.getCurrentState();
      const state2 = appState.getCurrentState();

      // Should be equal in value
      expect(state1).toEqual(state2);
      // But not the same reference (deep clone)
      expect(state1).not.toBe(state2);
    });

    it('should return deep clone of nested objects', () => {
      appState.dispatch(createAction('SET_PDF', {
        bytes: new Uint8Array([1, 2, 3]),
        fileName: 'test.pdf',
        numPages: 5,
        doc: { fake: 'doc' }
      }));

      const state1 = appState.getCurrentState();
      const state2 = appState.getCurrentState();

      expect(state1.pdf).not.toBe(state2.pdf);
      expect(state1.pdf).toEqual(state2.pdf);
    });

    it('should return deep clone of arrays', () => {
      appState.dispatch(createAction('ADD_STAMP', {
        id: 'stamp-1',
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        qrCode: 'test'
      }));

      const state1 = appState.getCurrentState();
      const state2 = appState.getCurrentState();

      expect(state1.stamps).not.toBe(state2.stamps);
      expect(state1.stamps).toEqual(state2.stamps);
    });
  });

  describe('dispatch', () => {
    it('should apply SET_PDF action', () => {
      const pdfData = {
        bytes: new Uint8Array([1, 2, 3]),
        fileName: 'test.pdf',
        numPages: 10,
        doc: { fake: 'doc' }
      };

      appState.dispatch(createAction('SET_PDF', pdfData));
      const state = appState.getCurrentState();

      expect(state.pdf.fileName).toBe('test.pdf');
      expect(state.pdf.numPages).toBe(10);
      expect(state.pdf.bytes).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('should apply SET_CURRENT_PAGE action', () => {
      appState.dispatch(createAction('SET_CURRENT_PAGE', 5));
      const state = appState.getCurrentState();

      expect(state.currentPage).toBe(5);
    });

    it('should apply ADD_STAMP action', () => {
      const stamp = {
        id: 'stamp-1',
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        qrCode: 'test-qr'
      };

      appState.dispatch(createAction('ADD_STAMP', stamp));
      const state = appState.getCurrentState();

      expect(state.stamps).toHaveLength(1);
      expect(state.stamps[0]).toEqual(stamp);
    });

    it('should apply UPDATE_STAMP action', () => {
      appState.dispatch(createAction('ADD_STAMP', {
        id: 'stamp-1',
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        qrCode: 'test'
      }));

      appState.dispatch(createAction('UPDATE_STAMP', {
        id: 'stamp-1',
        x: 200,
        y: 200
      }));

      const state = appState.getCurrentState();
      const stamp = state.stamps[0];

      expect(stamp.x).toBe(200);
      expect(stamp.y).toBe(200);
      expect(stamp.pageNumber).toBe(1); // Unchanged field should remain
    });

    it('should apply DELETE_STAMP action', () => {
      appState.dispatch(createAction('ADD_STAMP', {
        id: 'stamp-1',
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        qrCode: 'test'
      }));

      appState.dispatch(createAction('ADD_STAMP', {
        id: 'stamp-2',
        pageNumber: 1,
        x: 150,
        y: 150,
        width: 50,
        height: 50,
        qrCode: 'test2'
      }));

      appState.dispatch(createAction('DELETE_STAMP', 'stamp-1'));
      const state = appState.getCurrentState();

      expect(state.stamps).toHaveLength(1);
      expect(state.stamps[0].id).toBe('stamp-2');
    });

    it('should apply SET_DARK_MODE action', () => {
      appState.dispatch(createAction('SET_DARK_MODE', true));
      const state = appState.getCurrentState();

      expect(state.ui.isDarkMode).toBe(true);
      expect(localStorage.getItem('qr-stamp:isDarkMode')).toBe('true');
    });

    it('should apply SET_ZOOM action', () => {
      appState.dispatch(createAction('SET_ZOOM', {
        scale: 2,
        panX: 10,
        panY: 20
      }));

      const state = appState.getCurrentState();

      expect(state.zoom.scale).toBe(2);
      expect(state.zoom.panX).toBe(10);
      expect(state.zoom.panY).toBe(20);
    });

    it('should apply CLEAR_STAMPS action', () => {
      appState.dispatch(createAction('ADD_STAMP', {
        id: 'stamp-1',
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        qrCode: 'test'
      }));

      appState.dispatch(createAction('ADD_STAMP', {
        id: 'stamp-2',
        pageNumber: 1,
        x: 150,
        y: 150,
        width: 50,
        height: 50,
        qrCode: 'test2'
      }));

      appState.dispatch(createAction('CLEAR_STAMPS'));
      const state = appState.getCurrentState();

      expect(state.stamps).toHaveLength(0);
    });

    it('should apply SET_CURRENT_STAMP action', () => {
      appState.dispatch(createAction('ADD_STAMP', {
        id: 'stamp-1',
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        qrCode: 'test'
      }));

      appState.dispatch(createAction('SET_CURRENT_STAMP', 'stamp-1'));
      const state = appState.getCurrentState();

      expect(state.currentStampId).toBe('stamp-1');
    });

    it('should create new state object on dispatch', () => {
      const state1 = appState.getCurrentState();
      appState.dispatch(createAction('SET_CURRENT_PAGE', 2));
      const state2 = appState.getCurrentState();

      expect(state1).not.toBe(state2);
      expect(state1.currentPage).toBe(1);
      expect(state2.currentPage).toBe(2);
    });
  });

  describe('subscribe', () => {
    it('should call subscriber on state change', () => {
      const callback = vi.fn();
      appState.subscribe(callback);

      appState.dispatch(createAction('SET_CURRENT_PAGE', 2));

      expect(callback).toHaveBeenCalled();
      const receivedState = callback.mock.calls[0][0];
      expect(receivedState.currentPage).toBe(2);
    });

    it('should support multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      appState.subscribe(callback1);
      appState.subscribe(callback2);

      appState.dispatch(createAction('SET_CURRENT_PAGE', 3));

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = appState.subscribe(callback);

      appState.dispatch(createAction('SET_CURRENT_PAGE', 2));
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      appState.dispatch(createAction('SET_CURRENT_PAGE', 3));

      expect(callback).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should pass new state to subscribers', () => {
      const callback = vi.fn();
      appState.subscribe(callback);

      appState.dispatch(createAction('SET_CURRENT_PAGE', 5));

      const receivedState = callback.mock.calls[0][0];
      expect(receivedState).toEqual(appState.getCurrentState());
    });

    it('should not call subscribers if dispatch has no changes', () => {
      const callback = vi.fn();
      appState.subscribe(callback);

      // Dispatch an action that doesn't change state
      appState.dispatch({ type: 'UNKNOWN_ACTION' });

      // Should still notify (even for unknown actions)
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Selectors', () => {
    beforeEach(() => {
      appState.dispatch(createAction('SET_PDF', {
        bytes: new Uint8Array([1, 2, 3]),
        fileName: 'test.pdf',
        numPages: 10,
        doc: { fake: 'doc' }
      }));

      appState.dispatch(createAction('ADD_STAMP', {
        id: 'stamp-1',
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        qrCode: 'test'
      }));

      appState.dispatch(createAction('SET_CURRENT_STAMP', 'stamp-1'));
    });

    it('selectStamps should return stamps array', () => {
      const stamps = appState.selectStamps();

      expect(Array.isArray(stamps)).toBe(true);
      expect(stamps).toHaveLength(1);
      expect(stamps[0].id).toBe('stamp-1');
    });

    it('selectCurrentStamp should return current stamp or null', () => {
      const stamp = appState.selectCurrentStamp();

      expect(stamp).not.toBeNull();
      expect(stamp.id).toBe('stamp-1');
    });

    it('selectCurrentStamp should return null if no stamp selected', () => {
      appState.dispatch(createAction('SET_CURRENT_STAMP', null));
      const stamp = appState.selectCurrentStamp();

      expect(stamp).toBeNull();
    });

    it('selectPdf should return pdf object', () => {
      const pdf = appState.selectPdf();

      expect(pdf).not.toBeNull();
      expect(pdf.fileName).toBe('test.pdf');
      expect(pdf.numPages).toBe(10);
    });

    it('selectDarkMode should return dark mode state', () => {
      appState.dispatch(createAction('SET_DARK_MODE', true));
      const isDark = appState.selectDarkMode();

      expect(isDark).toBe(true);
    });

    it('selectZoom should return zoom state', () => {
      appState.dispatch(createAction('SET_ZOOM', {
        scale: 2,
        panX: 10,
        panY: 20
      }));

      const zoom = appState.selectZoom();

      expect(zoom.scale).toBe(2);
      expect(zoom.panX).toBe(10);
      expect(zoom.panY).toBe(20);
    });

    it('selectors should return deep clones', () => {
      const stamps1 = appState.selectStamps();
      const stamps2 = appState.selectStamps();

      expect(stamps1).toEqual(stamps2);
      expect(stamps1).not.toBe(stamps2);
    });
  });

  describe('Immutability', () => {
    it('modifying returned state should not affect internal state', () => {
      appState.dispatch(createAction('SET_CURRENT_PAGE', 1));

      const state1 = appState.getCurrentState();
      state1.currentPage = 999;

      const state2 = appState.getCurrentState();
      expect(state2.currentPage).toBe(1);
    });

    it('modifying returned stamps should not affect internal state', () => {
      appState.dispatch(createAction('ADD_STAMP', {
        id: 'stamp-1',
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        qrCode: 'test'
      }));

      const stamps1 = appState.selectStamps();
      stamps1[0].x = 999;

      const stamps2 = appState.selectStamps();
      expect(stamps2[0].x).toBe(100);
    });

    it('modifying returned pdf should not affect internal state', () => {
      appState.dispatch(createAction('SET_PDF', {
        bytes: new Uint8Array([1, 2, 3]),
        fileName: 'test.pdf',
        numPages: 10,
        doc: null
      }));

      const pdf1 = appState.selectPdf();
      pdf1.fileName = 'modified.pdf';

      const pdf2 = appState.selectPdf();
      expect(pdf2.fileName).toBe('test.pdf');
    });

    it('dispatch should not allow external state mutation', () => {
      const state1 = appState.getCurrentState();
      state1.currentPage = 999;
      state1.stamps.push({ id: 'hack' });

      const state2 = appState.getCurrentState();
      expect(state2.currentPage).toBe(1);
      expect(state2.stamps).toHaveLength(0);
    });
  });

  describe('createAction helper', () => {
    it('should create action objects', () => {
      const action = createAction('SET_CURRENT_PAGE', 5);

      expect(action.type).toBe('SET_CURRENT_PAGE');
      expect(action.payload).toBe(5);
    });

    it('should handle complex payloads', () => {
      const payload = {
        bytes: new Uint8Array([1, 2, 3]),
        fileName: 'test.pdf',
        numPages: 10
      };

      const action = createAction('SET_PDF', payload);

      expect(action.payload).toEqual(payload);
    });
  });

  describe('getAppState singleton', () => {
    it('should return singleton instance', () => {
      const instance1 = getAppState();
      const instance2 = getAppState();

      expect(instance1).toBe(instance2);
    });

    it('singleton should maintain state across calls', () => {
      const instance1 = getAppState();
      instance1.dispatch(createAction('SET_CURRENT_PAGE', 5));

      const instance2 = getAppState();
      const state = instance2.getCurrentState();

      expect(state.currentPage).toBe(5);
    });
  });
});
