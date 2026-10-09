import { requireEventOwner } from "@/lib/server/guards";
import { parseFormSchema } from "@/lib/ticketing/form-schema";
import { FormBuilder } from "../_components/FormBuilder";

export default async function FormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const schema = parseFormSchema(event.formSchema) ?? { version: 1 as const, fields: [] };

  return <FormBuilder eventId={event.id} initialFields={schema.fields} />;
}
