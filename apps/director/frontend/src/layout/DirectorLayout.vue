/**
 * Director Layout Implementation
 * Using the unified @higgsfield/layout system for Vue
 */

<template>
  <AppShell :config="appShellConfig">
    <Header :config="headerConfig">
      <template #logo>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
            D
          </div>
          <span style="font-weight: bold; font-size: 18px; color: white;">Director</span>
        </div>
      </template>
      
      <template #actions>
        <button
          type="button"
          aria-label="Back"
          title="Back"
          @click="goBack"
          style="padding: 8px; color: var(--text-secondary); transition: color 150ms;"
          class="dir-nav-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="All studios"
          title="All studios"
          @click="toggleSidebar"
          style="padding: 8px; color: var(--text-secondary); transition: color 150ms;"
          class="dir-nav-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
      </template>
    </Header>
    
    <div style="display: flex; flex: 1;">
      <Sidebar :config="sidebarConfig" />
      
      <ContentArea>
        <slot></slot>
      </ContentArea>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { useRouter } from 'vue-router';
import { 
  AppShell, 
  Header, 
  Sidebar, 
  ContentArea,
  defaultAppShellConfig,
  defaultHeaderConfig,
  defaultSidebarConfig,
  NavigationItem,
  SidebarItem
} from '@higgsfield/layout/vue';

// Director-specific navigation items
const navigationItems: NavigationItem[] = [
  { label: 'Chat', route: 'chat' },
  { label: 'Search', route: 'search' },
  { label: 'Edit', route: 'edit' },
  { label: 'Compile', route: 'compile' },
  { label: 'Generate', route: 'generate' },
];

// Director-specific sidebar items
const sidebarItems: SidebarItem[] = [
  { label: 'New Chat', route: 'new-chat', icon: '💬' },
  { label: 'Video Search', route: 'video-search', icon: '🔍' },
  { label: 'Video Edit', route: 'video-edit', icon: '✂️' },
  { label: 'Generate', route: 'generate', icon: '🎬' },
  { label: 'History', route: 'history', icon: '📜' },
];

const appShellConfig = defaultAppShellConfig;

const headerConfig = {
  ...defaultHeaderConfig,
  navigation: {
    enabled: true,
    items: navigationItems,
  },
};

const sidebarConfig = {
  ...defaultSidebarConfig,
  collapsible: true,
  items: sidebarItems,
};

// Sidebar toggle (reveals the "All studios" list) is provided by AppShell.
const appShell = inject<{
  sidebarCollapsed: { value: boolean };
  toggleSidebar: () => void;
}>('appShell');

const toggleSidebar = () => appShell?.toggleSidebar();

// Back button returns to the default Director view.
const router = useRouter();
const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push('/');
};
</script>
