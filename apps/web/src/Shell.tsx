import { Link, NavLink, Outlet } from "react-router-dom";

export function Shell() {
  return (
    <div className="shell">
      <header className="top">
        <Link to="/" className="brand">
          <span className="bars" aria-hidden />
          Pollscale
        </Link>
        <nav>
          <NavLink to="/guidelines">Guidelines</NavLink>
          <NavLink to="/privacy">Privacy</NavLink>
          <NavLink to="/terms">Terms</NavLink>
          <NavLink to="/support">Support</NavLink>
        </nav>
      </header>
      <Outlet />
      <footer>
        <p>
          Questions: <a href="mailto:support@pollscale.com">support@pollscale.com</a>
          {" · "}
          <a href="mailto:legal@pollscale.com">legal@pollscale.com</a>
        </p>
      </footer>
    </div>
  );
}
