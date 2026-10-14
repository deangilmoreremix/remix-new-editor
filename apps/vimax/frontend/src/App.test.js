import { render, screen } from '@testing-library/react';
import Sidebar from './components/Sidebar';
import { ThemeProvider } from './ThemeContext';

test('renders the wizard sidebar', () => {
  render(
    <ThemeProvider>
      <Sidebar
        activeView="wizard"
        onViewChange={() => {}}
        userStats={{ total_generations: 0, average_rating: 0 }}
        historyCount={0}
        batchCount={0}
        onNewVideo={() => {}}
      />
    </ThemeProvider>
  );
  expect(screen.getByText(/New Video/i)).toBeInTheDocument();
});
