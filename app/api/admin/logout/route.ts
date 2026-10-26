import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    // [SECURITY] Guard: require admin secret or valid admin session cookie
    const adminKey = req.headers.get('x-admin-key');
    const adminCookie = req.cookies.get('admin_token')?.value;
    const expectedKey = process.env.ADMIN_SECRET;

    // Allow if either a valid x-admin-key header OR a valid admin_token cookie is present
    const hasValidKey = expectedKey && adminKey === expectedKey;
    const hasCookie = !!adminCookie; // Cookie presence means a previous login granted the session

    if (!hasValidKey && !hasCookie) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = NextResponse.json({
        success: true,
        message: "Logged out successfully",
    });

    // Clear the admin token cookie
    response.cookies.delete("admin_token");

    return response;
}
