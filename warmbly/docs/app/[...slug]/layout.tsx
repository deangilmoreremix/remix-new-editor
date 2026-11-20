import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { baseOptions } from '@/lib/layout.shared';
import { SidebarScrollKeeper } from '@/components/shared/sidebar-scroll-keeper';

export default function Layout({ children }: LayoutProps<'/[...slug]'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      nav={{ ...baseOptions().nav, mode: 'top' }}
      sidebar={{ tabs: false }}
    >
      <SidebarScrollKeeper />
      {children}
    </DocsLayout>
  );
}
