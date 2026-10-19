import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen space-y-8 text-center bg-transparent">
            {/* Background Texture */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: 'url("/api/checkpoint-image?name=patron-cosmico-4k.png")',
                    backgroundSize: '300px auto',
                    backgroundPosition: 'center'
                }}
            />

            <div className="relative z-10 space-y-6">
                <div className="flex flex-col items-center">
                    <h1 className="text-[140px] font-black text-black/5 leading-none tracking-tighter mix-blend-multiply">
                        404
                    </h1>
                    <h2 className="text-3xl font-black text-black uppercase tracking-widest mt-[-20px] bg-transparent px-4">
                        Void Protocol
                    </h2>
                </div>

                <div className="space-y-2">
                    <p className="text-[13px] font-bold text-black/40 uppercase tracking-[0.2em] max-w-sm mx-auto">
                        The requested telemetry coordinate does not exist.
                    </p>
                    <p className="text-[11px] font-mono text-[#00F2EA] font-bold uppercase tracking-widest bg-black/5 px-3 py-1 rounded inline-block">
                        err_coord_null
                    </p>
                </div>

                <div className="pt-8 flex items-center justify-center gap-4 border-t border-black/[0.06] w-full max-w-md mx-auto">
                    <Link 
                        href="/"
                        className="px-8 py-3.5 bg-black text-white text-[11px] font-black uppercase tracking-[0.25em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10 hover:shadow-black/20"
                    >
                        Return to Network
                    </Link>
                </div>
            </div>
        </div>
    );
}
