import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ChatCommunityGateProps {
    onAccept: () => void;
    onDecline: () => void;
}

export function ChatCommunityGate({ onAccept, onDecline }: ChatCommunityGateProps) {
    return (
        <div className="fixed inset-0 z-[500] bg-white flex flex-col items-center justify-center p-6 text-black">
            <div className="max-w-md w-full bg-[#f9f8f6] p-8 rounded-3xl border border-[#ebebeb] shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="text-red-500" size={28} />
                    <h2 className="text-2xl font-black">Community Guidelines</h2>
                </div>
                <div className="h-48 overflow-y-auto text-sm text-gray-600 space-y-4 pr-2 mb-6 border border-gray-200 p-4 rounded-xl">
                    <p>By using LedgerChat, you agree to the following terms required for compliance:</p>
                    <p><strong>1. Zero Tolerance for Objectionable Content:</strong> You will not post, transmit, or share any content that is abusive, harassing, threatening, defamatory, offensive, or otherwise objectionable.</p>
                    <p><strong>2. User Moderation:</strong> You understand that other users may report your messages. If your account is reported multiple times for violating these guidelines, your access to Ledger Chat may be permanently revoked.</p>
                    <p><strong>3. Blocking:</strong> You have the ability to block any user. Blocked users will not be able to contact you.</p>
                    <p>By clicking "I Agree", you acknowledge that you have read and agree to these terms, and understand that violations will result in loss of access.</p>
                </div>
                <div className="flex flex-col gap-3">
                    <button onClick={onAccept} className="w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors">
                        I Agree
                    </button>
                    <button onClick={onDecline} className="w-full py-3 bg-transparent text-gray-500 font-bold rounded-xl hover:bg-gray-100 transition-colors border border-gray-300">
                        Decline
                    </button>
                </div>
            </div>
        </div>
    );
}
