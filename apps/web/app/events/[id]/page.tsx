import Link from "next/link";
import { EventDetail } from "@/components/events/EventDetail";
import { getEventById } from "@/lib/events/service";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const event = await getEventById(id);

  if (!event) {
    return (
      <main className="page-shell">
        <section className="empty-state">
          <h1>That event is no longer available.</h1>
          <p>It may have expired or been removed from the current scout results.</p>
          <Link href="/" className="text-link">
            Back to discovery
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <Link href="/" className="text-link">
        Back to discovery
      </Link>
      <EventDetail event={event} />
    </main>
  );
}
