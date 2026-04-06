// Upload History Management - Open-Higgsfield-AI Integration
// Local storage and management of uploaded images and videos

class UploadHistory {
  constructor(storageKey = 'videoPersonalizer_uploadHistory') {
    this.storageKey = storageKey;
    this.maxItems = 50; // Maximum items to store
    this.history = this.loadHistory();
  }

  // Load history from localStorage
  loadHistory() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load upload history:', error);
      return [];
    }
  }

  // Save history to localStorage
  saveHistory() {
    try {
      // Keep only the most recent items
      const trimmedHistory = this.history.slice(0, this.maxItems);
      localStorage.setItem(this.storageKey, JSON.stringify(trimmedHistory));
    } catch (error) {
      console.warn('Failed to save upload history:', error);
    }
  }

  // Add new upload to history
  addUpload(uploadData) {
    const upload = {
      id: this.generateId(),
      url: uploadData.url,
      filename: uploadData.filename,
      type: uploadData.type, // 'image' or 'video'
      size: uploadData.size,
      dimensions: uploadData.dimensions, // {width, height}
      duration: uploadData.duration, // for videos
      thumbnail: uploadData.thumbnail,
      uploadedAt: new Date().toISOString(),
      usageCount: 0,
      tags: uploadData.tags || []
    };

    // Add to beginning of array (most recent first)
    this.history.unshift(upload);
    this.saveHistory();

    return upload;
  }

  // Get upload by ID
  getUpload(id) {
    return this.history.find(item => item.id === id);
  }

  // Get all uploads
  getAllUploads() {
    return [...this.history];
  }

  // Get uploads by type
  getUploadsByType(type) {
    return this.history.filter(item => item.type === type);
  }

  // Get recent uploads (last N items)
  getRecentUploads(limit = 10) {
    return this.history.slice(0, limit);
  }

  // Search uploads by filename or tags
  searchUploads(query) {
    const lowercaseQuery = query.toLowerCase();
    return this.history.filter(item =>
      item.filename.toLowerCase().includes(lowercaseQuery) ||
      item.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  // Update upload usage count
  incrementUsage(id) {
    const upload = this.getUpload(id);
    if (upload) {
      upload.usageCount += 1;
      upload.lastUsed = new Date().toISOString();
      this.saveHistory();
    }
  }

  // Add tags to upload
  addTags(id, tags) {
    const upload = this.getUpload(id);
    if (upload) {
      upload.tags = [...new Set([...upload.tags, ...tags])]; // Remove duplicates
      this.saveHistory();
    }
  }

  // Remove tags from upload
  removeTags(id, tags) {
    const upload = this.getUpload(id);
    if (upload) {
      upload.tags = upload.tags.filter(tag => !tags.includes(tag));
      this.saveHistory();
    }
  }

  // Delete upload from history
  deleteUpload(id) {
    const index = this.history.findIndex(item => item.id === id);
    if (index !== -1) {
      this.history.splice(index, 1);
      this.saveHistory();
      return true;
    }
    return false;
  }

  // Clear all history
  clearHistory() {
    this.history = [];
    localStorage.removeItem(this.storageKey);
  }

  // Get storage usage statistics
  getStats() {
    const totalUploads = this.history.length;
    const images = this.history.filter(item => item.type === 'image').length;
    const videos = this.history.filter(item => item.type === 'video').length;
    const totalSize = this.history.reduce((sum, item) => sum + (item.size || 0), 0);
    const totalUsage = this.history.reduce((sum, item) => sum + (item.usageCount || 0), 0);

    return {
      totalUploads,
      images,
      videos,
      totalSize,
      totalUsage,
      averageUsage: totalUploads > 0 ? Math.round(totalUsage / totalUploads) : 0
    };
  }

  // Generate unique ID for uploads
  generateId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Export history as JSON
  exportHistory() {
    return JSON.stringify(this.history, null, 2);
  }

  // Import history from JSON
  importHistory(jsonData) {
    try {
      const imported = JSON.parse(jsonData);
      if (Array.isArray(imported)) {
        this.history = imported;
        this.saveHistory();
        return true;
      }
    } catch (error) {
      console.error('Failed to import history:', error);
    }
    return false;
  }

  // Clean up old entries (keep only recent ones)
  cleanup(maxAge = 30) { // days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    this.history = this.history.filter(item => {
      const itemDate = new Date(item.uploadedAt);
      return itemDate > cutoffDate || item.usageCount > 0; // Keep if recent or used
    });

    this.saveHistory();
  }
}

// Create singleton instance
const uploadHistory = new UploadHistory();

// Helper functions for easy access
export function addUploadToHistory(uploadData) {
  return uploadHistory.addUpload(uploadData);
}

export function getUploadHistory() {
  return uploadHistory.getAllUploads();
}

export function getRecentUploads(limit = 10) {
  return uploadHistory.getRecentUploads(limit);
}

export function searchUploads(query) {
  return uploadHistory.searchUploads(query);
}

export function deleteUploadFromHistory(id) {
  return uploadHistory.deleteUpload(id);
}

export function getUploadHistoryStats() {
  return uploadHistory.getStats();
}

export { UploadHistory };
export default uploadHistory;