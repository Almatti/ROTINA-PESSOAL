import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/", "/entrar", "/cadastro", "/recuperar-senha", "/redefinir-senha", "/privacidade", "/termos", "/offline", "/configuracao", "/auth"];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")) || (p === "/auth" && path.startsWith("/auth")));
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  if (!url || !anon) {
    // Sem backend configurado: só as páginas públicas funcionam.
    if (isPublic(path) || path.startsWith("/api")) return NextResponse.next();
    return NextResponse.redirect(new URL("/configuracao", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Renova a sessão e valida o token no servidor de autenticação.
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && !isPublic(path) && !path.startsWith("/api")) {
    const to = new URL("/entrar", request.url);
    to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  }
  if (user && (path === "/" || path === "/entrar" || path === "/cadastro")) {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
