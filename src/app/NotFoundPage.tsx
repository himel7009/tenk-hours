import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div>
      <h1>This page does not exist</h1>
      <p style={{ marginTop: 'var(--space-4)' }}>
        <Link to="/">Go to your skills</Link>
      </p>
    </div>
  );
}
