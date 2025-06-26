import { EditTripForm } from '@/components/trips/edit-trip-form';

interface EditTripPageProps {
  params: {
    id: string;
  };
}

export default function EditTripPage({ params }: EditTripPageProps) {
  return (
    <div className="container px-4 py-6 space-y-4">
      <h1 className="text-2xl font-semibold">Edit Trip</h1>
      <EditTripForm tripId={params.id} />
    </div>
  );
} 