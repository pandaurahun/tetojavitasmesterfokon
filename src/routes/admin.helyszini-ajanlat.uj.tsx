import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin/ui";
import { FieldQuoteEditor } from "@/components/admin/FieldQuoteEditor";

export const Route = createFileRoute("/admin/helyszini-ajanlat/uj")({
  head: () => ({
    meta: [{ title: "Új helyszíni ajánlat — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: NewFieldQuotePage,
});

function NewFieldQuotePage() {
  const navigate = useNavigate();
  return (
    <AdminPage
      title="Új helyszíni ajánlat"
      intro="Töltse ki az ügyfél és a felmérés adatait, majd vegye fel a tételeket."
    >
      <FieldQuoteEditor
        onSaved={(quote) =>
          void navigate({ to: "/admin/helyszini-ajanlat/$id", params: { id: quote.id } })
        }
      />
    </AdminPage>
  );
}
