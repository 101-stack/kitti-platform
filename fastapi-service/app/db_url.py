from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def normalize_database_url(url: str) -> str:
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    if not url.startswith("postgresql+asyncpg://"):
        return url

    parts = urlsplit(url)
    query_pairs = []

    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key == "sslmode":
            query_pairs.append(("ssl", value))
            continue
        if key == "channel_binding":
            continue
        query_pairs.append((key, value))

    return urlunsplit(parts._replace(query=urlencode(query_pairs)))
