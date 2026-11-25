import { test, expect } from "@playwright/test";
import { signup, onboard, uniqueEmail, rest, accessToken } from "./helpers";

test("isolamento entre usuárias (UI e API com RLS)", async ({ browser }) => {
  const a = await browser.newContext();
  const pa = await a.newPage();
  await signup(pa, "Usuária A", uniqueEmail("a"));
  await onboard(pa);
  await pa.goto("/tarefas");
  await pa.getByRole("button", { name: "Nova" }).click();
  await pa.getByLabel("Título").fill("Segredo da A");
  await pa.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(pa.getByText("Segredo da A")).toBeVisible();
  const aTasks = await rest(pa, "tasks?select=id,title");
  expect(aTasks).toHaveLength(1);

  const b = await browser.newContext();
  const pb = await b.newPage();
  await signup(pb, "Usuária B", uniqueEmail("b"));
  await onboard(pb);
  await pb.goto("/tarefas");
  await expect(pb.getByText("Nenhuma tarefa encontrada")).toBeVisible();
  // tentativa direta pela API com o id da tarefa da A
  expect(await rest(pb, `tasks?select=id&id=eq.${aTasks[0].id}`)).toEqual([]);
  const tokenB = await accessToken(pb);
  const res = await pb.request.patch(`http://127.0.0.1:54321/rest/v1/tasks?id=eq.${aTasks[0].id}`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${tokenB}`, Prefer: "return=representation", "Content-Type": "application/json" }, data: { title: "hackeado" } });
  expect(await res.json()).toEqual([]);
  expect((await rest(pa, "tasks?select=title"))[0].title).toBe("Segredo da A");
  await a.close();
  await b.close();
});
