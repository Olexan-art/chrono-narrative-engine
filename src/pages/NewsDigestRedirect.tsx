import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Redirect from legacy /news-digest URL to new /news
 */
export default function NewsDigestRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // 301 redirect simulation - replace current entry to avoid back button issues
    navigate("/news", { replace: true });
  }, [navigate]);

  return null;
}
