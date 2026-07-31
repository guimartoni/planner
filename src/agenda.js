import { getToken } from "./auth.js";

const GRAPH = "https://graph.microsoft.com/v1.0";

/* Busca os próximos 31 dias da agenda do Outlook via Microsoft Graph.
   "eq" = e-mails da equipe presentes entre os participantes do evento. */
export async function fetchCalendarEvents(teamEmails) {
  const token = await getToken();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 31);
  const url = `${GRAPH}/me/calendarView` +
    `?startDateTime=${encodeURIComponent(start.toISOString())}` +
    `&endDateTime=${encodeURIComponent(end.toISOString())}` +
    `&$orderby=start/dateTime&$top=100` +
    `&$select=subject,start,end,organizer,attendees,isOrganizer,location,isCancelled`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="America/Sao_Paulo"',
    },
  });
  if (!res.ok) throw new Error(`agenda HTTP ${res.status}`);
  const data = await res.json();
  const team = (teamEmails || []).map((e) => e.toLowerCase());
  return (data.value || [])
    .filter((e) => !e.isCancelled)
    .map((e) => ({
      titulo: (e.subject || "(sem título)").slice(0, 80),
      inicio: (e.start?.dateTime || "").slice(0, 16),
      fim: (e.end?.dateTime || "").slice(0, 16),
      organizador: (e.organizer?.emailAddress?.name || "").split(" ")[0],
      souOrganizador: !!e.isOrganizer,
      local: e.location?.displayName || "",
      eq: (e.attendees || [])
        .map((a) => (a.emailAddress?.address || "").toLowerCase())
        .filter((a) => team.includes(a)),
    }));
}
