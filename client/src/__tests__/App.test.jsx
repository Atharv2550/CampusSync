import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

describe('CampusSync Frontend Component & Routing Tests', () => {
  it('Renders Landing Page with CampusSync Brand and Tagline', () => {
    render(<App />);
    expect(screen.getAllByText(/CampusSync/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Your Campus,/i)).toBeInTheDocument();
  });

  it('Renders Instant Demo Login options for supported roles', () => {
    render(<App />);
    expect(screen.getByText(/Instant Demo Login/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Student/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Campus Admin/i).length).toBeGreaterThan(0);
  });
});

