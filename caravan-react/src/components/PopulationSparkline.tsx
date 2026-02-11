import React from 'react';

interface PopulationSparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    className?: string;
}

export const PopulationSparkline: React.FC<PopulationSparklineProps> = ({
    data,
    width = 100,
    height = 30,
    color = '#10b981', // Emerald-500
    className = ''
}) => {
    if (!data || data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // Avoid divide by zero

    // Generate points
    const points = data.map((val, index) => {
        const x = (index / (data.length - 1)) * width;
        // Invert Y so higher values are higher up
        const normalizedVal = (val - min) / range;
        const y = height - (normalizedVal * height);
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className={className} style={{ overflow: 'visible' }}>
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Start Dot */}
            <circle cx="0" cy={height - ((data[0] - min) / range * height)} r="2" fill={color} />
            {/* End Dot */}
            <circle cx={width} cy={height - ((data[data.length - 1] - min) / range * height)} r="2" fill={color} />
        </svg>
    );
};
