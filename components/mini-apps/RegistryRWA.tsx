import React from 'react';

export const RegistryRWA: React.FC = () => {
  const assets = [
    {
      id: 'RWA-8921',
      type: 'Real Estate',
      name: 'Commercial Unit A - Silicon Tower',
      oracle: 'Chainlink Property Data',
      status: 'Verified',
      value: '$450,000'
    },
    {
      id: 'RWA-1044',
      type: 'Vehicle',
      name: 'Tesla Model S Plaid 2024',
      oracle: 'DMV Integration API',
      status: 'Verified',
      value: '$95,000'
    }
  ];

  return (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-3xl shadow-sm border border-black/5">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight">RWA Registry</h2>
          <p className="text-sm text-black/60">Manage your tokenized Real World Assets.</p>
        </div>
        <button className="text-sm font-medium px-4 py-2 bg-black text-white rounded-xl hover:bg-black/80 transition-colors">
          + Tokenize Asset
        </button>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        {assets.map((asset) => (
          <div key={asset.id} className="p-4 border border-black/10 rounded-2xl flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-black/40 uppercase tracking-wider bg-black/5 px-2 py-1 rounded-md">
                  {asset.type}
                </span>
                <h3 className="font-semibold text-sm mt-2">{asset.name}</h3>
              </div>
              <p className="font-bold text-emerald-600">{asset.value}</p>
            </div>
            <div className="flex justify-between items-center mt-2 pt-3 border-t border-black/5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <p className="text-xs text-black/60">Oracle: {asset.oracle}</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                {asset.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
