import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      {
        error: "Authorization code tidak ditemukan",
      },
      {
        status: 400,
      },
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  const redirectUri = "http://localhost:3000/api/auth/google/callback";

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    console.log("================================");

    console.log("REFRESH TOKEN:");

    console.log(tokens.refresh_token);

    console.log("================================");

    return NextResponse.json({
      success: true,

      message: "Refresh token berhasil dibuat. Cek terminal.",

      refresh_token: tokens.refresh_token,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Gagal mengambil refresh token",
      },
      {
        status: 500,
      },
    );
  }
}
