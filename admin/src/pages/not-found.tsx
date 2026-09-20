import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">No such page</h1>
      <p className="mt-2 text-muted-foreground">
        The address does not match any page of the panel.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">To the dashboard</Link>
      </Button>
    </div>
  );
}
