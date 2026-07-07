import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

let cachedToken = null;
let tokenExpirationTime = 0;

async function getSpotifyToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpirationTime) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Spotify nao configuradas.");
  }

  const basicAuth = Buffer
    .from(`${clientId}:${clientSecret}`)
    .toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar token: ${errorText}`);
  }

  const data = await response.json();

  cachedToken = data.access_token;
  tokenExpirationTime = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken;
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Backend Spotify funcionando no Render!"
  });
});

app.get("/api/spotify/search", async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({
        error: "Envie o parametro q. Exemplo: /api/spotify/search?q=Coldplay"
      });
    }

    const token = await getSpotifyToken();

    const spotifyUrl = new URL("https://api.spotify.com/v1/search");
    spotifyUrl.searchParams.append("q", query);
    spotifyUrl.searchParams.append("type", "track,artist,album");
    spotifyUrl.searchParams.append("limit", "10");
    spotifyUrl.searchParams.append("market", "BR");

    const response = await fetch(spotifyUrl, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: "Erro na API do Spotify",
        details: errorText
      });
    }

    const data = await response.json();

    const tracks = data.tracks?.items?.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists?.map((artist) => artist.name).join(", "),
      album: track.album?.name,
      image: track.album?.images?.[0]?.url || null,
      spotifyUrl: track.external_urls?.spotify || null
    })) || [];

    const artists = data.artists?.items?.map((artist) => ({
      id: artist.id,
      name: artist.name,
      image: artist.images?.[0]?.url || null,
      spotifyUrl: artist.external_urls?.spotify || null
    })) || [];

    const albums = data.albums?.items?.map((album) => ({
      id: album.id,
      name: album.name,
      artist: album.artists?.map((artist) => artist.name).join(", "),
      image: album.images?.[0]?.url || null,
      spotifyUrl: album.external_urls?.spotify || null
    })) || [];

    res.json({
      query,
      tracks,
      artists,
      albums
    });
  } catch (error) {
    res.status(500).json({
      error: "Erro interno no backend",
      message: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});