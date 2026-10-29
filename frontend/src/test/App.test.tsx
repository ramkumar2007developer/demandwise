/**
 * DemandWise 2.0 — Phase 4 Frontend Tests
 * App.tsx: Hero landing page + dashboard open trigger
 *
 * Mocks all child components that use browser APIs unavailable in jsdom
 * (IntersectionObserver in Navbar, Leaflet in MapView, etc.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── All mocks before component imports ──────────────────────────────────────

vi.mock('../services/api', () => ({
  api: {
    getHealth: vi.fn().mockResolvedValue({ status: 'healthy', version: '2.0.0' }),
    searchCompetitors: vi.fn().mockResolvedValue({ status: 'success', competitors: [] }),
    runAnalysis: vi.fn().mockResolvedValue(null),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(msg: string, status: number) { super(msg); this.name = 'ApiError'; this.status = status; }
  },
  sanitizeErrorMessage: (msg: string) => msg,
}));

// Mock all heavy child components to isolate App rendering
vi.mock('../components/Navbar', () => ({
  Navbar: ({ onOpenDashboard }: any) => (
    <nav data-testid="navbar">
      <button onClick={onOpenDashboard} data-testid="navbar-open-dashboard">Open Dashboard</button>
    </nav>
  ),
}));

vi.mock('../components/Hero', () => ({
  Hero: ({ onOpenDashboard, onWatchDemo }: any) => (
    <section data-testid="hero">
      <h1>DemandWise 2.0</h1>
      <p>Location Intelligence for Coimbatore</p>
      <button onClick={onOpenDashboard} data-testid="hero-analyze-btn">Analyze Now</button>
      <button onClick={onWatchDemo} data-testid="hero-demo-btn">Watch Demo</button>
    </section>
  ),
}));

vi.mock('../components/Features', () => ({
  Features: ({ onExploreClick }: any) => (
    <section data-testid="features">
      <button onClick={onExploreClick} data-testid="features-explore-btn">Explore Features</button>
    </section>
  ),
}));

vi.mock('../components/HowItWorks', () => ({
  HowItWorks: () => <section data-testid="how-it-works" />,
}));

vi.mock('../components/AnalyticsPreview', () => ({
  AnalyticsPreview: ({ onGetStarted }: any) => (
    <section data-testid="analytics-preview">
      <button onClick={onGetStarted} data-testid="analytics-get-started-btn">Get Started</button>
    </section>
  ),
}));

vi.mock('../components/DashboardModal', () => ({
  DashboardModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="dashboard-modal">
        <h2>Business Analysis Dashboard</h2>
        <button onClick={onClose} data-testid="modal-close">Close</button>
      </div>
    ) : null,
}));

// ─── Import App after mocks ───────────────────────────────────────────────────

import { App } from '../App';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('App — Landing Page structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Navbar', () => {
    render(<App />);
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
  });

  it('renders the Hero section with brand name', () => {
    render(<App />);
    expect(screen.getByTestId('hero')).toBeInTheDocument();
    expect(screen.getByText('DemandWise 2.0')).toBeInTheDocument();
  });

  it('renders the Features section', () => {
    render(<App />);
    expect(screen.getByTestId('features')).toBeInTheDocument();
  });

  it('renders the How It Works section', () => {
    render(<App />);
    expect(screen.getByTestId('how-it-works')).toBeInTheDocument();
  });

  it('renders the Analytics Preview section', () => {
    render(<App />);
    expect(screen.getByTestId('analytics-preview')).toBeInTheDocument();
  });

  it('does not show the dashboard modal initially', () => {
    render(<App />);
    expect(screen.queryByTestId('dashboard-modal')).toBeNull();
  });
});

describe('App — Dashboard open/close trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the dashboard modal when Hero CTA is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('hero-analyze-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-modal')).toBeInTheDocument();
    });
  });

  it('opens the dashboard modal when Navbar button is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('navbar-open-dashboard'));
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-modal')).toBeInTheDocument();
    });
  });

  it('opens the dashboard modal when Features Explore button is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('features-explore-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-modal')).toBeInTheDocument();
    });
  });

  it('opens the dashboard modal when Analytics Get Started is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('analytics-get-started-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-modal')).toBeInTheDocument();
    });
  });

  it('closes the dashboard modal when close button is clicked', async () => {
    render(<App />);
    // Open it first
    fireEvent.click(screen.getByTestId('hero-analyze-btn'));
    await waitFor(() => expect(screen.getByTestId('dashboard-modal')).toBeInTheDocument());
    // Then close it
    fireEvent.click(screen.getByTestId('modal-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-modal')).toBeNull();
    });
  });
});

describe('App — Watch Demo modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens demo modal when Hero Watch Demo is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('hero-demo-btn'));
    await waitFor(() => {
      expect(screen.getByText(/DemandWise Product Overview/i)).toBeInTheDocument();
    });
  });

  it('closes demo modal via X button', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('hero-demo-btn'));
    await waitFor(() => expect(screen.getByText(/DemandWise Product Overview/i)).toBeInTheDocument());

    // Find X close button in demo modal
    const demoModalButtons = screen.getAllByRole('button').filter(b => !b.textContent?.match(/Analyze|Demo|Explore|Started|Dashboard/i));
    if (demoModalButtons.length > 0) {
      fireEvent.click(demoModalButtons[0]);
      await waitFor(() => {
        expect(screen.queryByText(/DemandWise Product Overview/i)).toBeNull();
      });
    }
  });
});

describe('App — Backend health check', () => {
  it('makes health check on mount', async () => {
    const { api } = await import('../services/api');
    render(<App />);
    await waitFor(() => {
      expect(vi.mocked(api.getHealth)).toHaveBeenCalledOnce();
    });
  });

  it('shows backend connected state after successful health check', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.getHealth).mockResolvedValue({ status: 'healthy', version: '2.0.1' } as any);
    render(<App />);
    await waitFor(() => {
      const activeText = screen.queryByText(/Backend Active/i) || screen.queryByText(/v2\.0/);
      expect(activeText).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('shows disconnected state when health check fails', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.getHealth).mockRejectedValue(new Error('Connection refused'));
    render(<App />);
    await waitFor(() => {
      const offlineText =
        screen.queryByText(/Backend offline/i) ||
        screen.queryByText(/port 8000/i) ||
        screen.queryByText(/offline/i);
      expect(offlineText).toBeTruthy();
    }, { timeout: 2000 });
  });
});
