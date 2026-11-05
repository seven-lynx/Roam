import { matchWindowRoute } from "../lib/os-routes";

describe("os route registry", () => {
  it("maps static app routes to window titles", () => {
    expect(matchWindowRoute("/submit")).toEqual({ href: "/submit", title: "Upload URL" });
    expect(matchWindowRoute("/profile")).toEqual({ href: "/profile", title: "Profile" });
    expect(matchWindowRoute("/settings")).toEqual({ href: "/settings", title: "Settings" });
    expect(matchWindowRoute("/collections")).toEqual({ href: "/collections", title: "Collections" });
    expect(matchWindowRoute("/badges")).toEqual({ href: "/badges", title: "Badges" });
    expect(matchWindowRoute("/challenges")).toEqual({ href: "/challenges", title: "Challenges" });
    expect(matchWindowRoute("/leaderboard")).toEqual({ href: "/leaderboard", title: "Rankings" });
    expect(matchWindowRoute("/following")).toEqual({ href: "/following", title: "Following" });
    expect(matchWindowRoute("/people")).toEqual({ href: "/people", title: "People" });
  });

  it("matches dynamic app routes by prefix", () => {
    expect(matchWindowRoute("/collections/my-books")).toEqual({
      href: "/collections/my-books",
      title: "Collection",
    });
    expect(matchWindowRoute("/u/alice")).toEqual({ href: "/u/alice", title: "Profile" });
  });

  it("returns null for the desktop and non-app pages", () => {
    expect(matchWindowRoute("/")).toBeNull();
    expect(matchWindowRoute("/desktop")).toBeNull();
    expect(matchWindowRoute("/how-it-works")).toBeNull();
    expect(matchWindowRoute("/signup")).toBeNull();
    expect(matchWindowRoute("/privacy")).toBeNull();
    expect(matchWindowRoute("/admin")).toBeNull();
    expect(matchWindowRoute("/api/home-stats")).toBeNull();
  });
});
