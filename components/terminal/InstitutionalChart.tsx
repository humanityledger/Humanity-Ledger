"use client";

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, HistogramSeries, AreaSeries } from 'lightweight-charts';

interface ChartProps {
  data: { time: string; value: number }[];
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
  title?: string;
  isZScoreMode?: boolean;
}

export const InstitutionalChart: React.FC<ChartProps> = ({
  data,
  colors: {
    backgroundColor = '#050505',
    lineColor = '#4F46E5', // Indigo-600
    textColor = '#FFFFFF',
    areaTopColor = 'rgba(79, 70, 229, 0.4)',
    areaBottomColor = 'rgba(79, 70, 229, 0.05)',
  } = {},
  title = "Macro Allocation",
  isZScoreMode = false
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.2, bottom: 0.2 },
      },
    };

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    let series: ISeriesApi<"Area"> | ISeriesApi<"Histogram">;

    if (isZScoreMode) {
      // Rotation Heatmap style (Histogram)
      series = chart.addSeries(HistogramSeries, {
        color: lineColor,
        priceFormat: { type: 'volume' },
      });
      // Color conditionally based on positive/negative
      const zData = data.map(d => ({
        ...d, 
        color: d.value >= 0 ? '#00C076' : '#FF4C4C' 
      }));
      series.setData(zData);
    } else {
      // Standard TVL / Volume format (Area)
      series = chart.addSeries(AreaSeries, {
        lineColor,
        topColor: areaTopColor,
        bottomColor: areaBottomColor,
        lineWidth: 2,
      });
      series.setData(data);
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, backgroundColor, lineColor, textColor, areaTopColor, areaBottomColor, isZScoreMode]);

  return (
    <div className="w-full relative border border-white/10 rounded-2xl p-4 bg-white">
       <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
         <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
         <h3 className="text-[10px] font-black tracking-widest uppercase opacity-70 border border-white/10 bg-white/5 px-2 py-1 rounded-sm">
           {title}
         </h3>
       </div>
       <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};
