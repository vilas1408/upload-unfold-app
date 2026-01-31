import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CommodityFundamentals {
  inventory: {
    level: string;
    change: number;
    trend: string;
    details: string;
  };
  production: {
    outlook: string;
    factors: string[];
  };
  consumption: {
    outlook: string;
    factors: string[];
  };
  geopolitical: {
    risk: 'Low' | 'Medium' | 'High';
    factors: string[];
  };
  weather: {
    impact: string;
    details: string;
  };
  supplyDemandBalance: 'Surplus' | 'Deficit' | 'Balanced';
  priceDrivers: string[];
  timestamp: string;
}

function getGoldFundamentals(): CommodityFundamentals {
  return {
    inventory: {
      level: 'Moderate',
      change: -1.2,
      trend: 'Declining',
      details: 'COMEX gold warehouse stocks showing gradual decline as ETF flows remain positive'
    },
    production: {
      outlook: 'Stable',
      factors: [
        'Major producers maintaining output levels',
        'New mine developments limited due to high costs',
        'Recycling volumes steady'
      ]
    },
    consumption: {
      outlook: 'Strong',
      factors: [
        'Central bank buying continues (China, Russia, India)',
        'India wedding season demand elevated',
        'Investment demand robust amid economic uncertainty'
      ]
    },
    geopolitical: {
      risk: 'Medium',
      factors: [
        'US-China trade tensions',
        'Middle East instability',
        'Central bank diversification from USD',
        'Potential Fed policy shifts'
      ]
    },
    weather: {
      impact: 'Minimal',
      details: 'Weather has limited direct impact on gold production'
    },
    supplyDemandBalance: 'Deficit',
    priceDrivers: [
      'USD strength/weakness primary driver',
      'Real interest rates correlation',
      'Safe-haven demand during risk-off periods',
      'Central bank reserve accumulation'
    ],
    timestamp: new Date().toISOString()
  };
}

function getSilverFundamentals(): CommodityFundamentals {
  return {
    inventory: {
      level: 'Low',
      change: -2.5,
      trend: 'Declining',
      details: 'COMEX silver inventories at multi-year lows, industrial demand absorbing supply'
    },
    production: {
      outlook: 'Constrained',
      factors: [
        '70% comes as byproduct from base metals mining',
        'Primary silver mines facing cost pressures',
        'Mexican production stable but not expanding'
      ]
    },
    consumption: {
      outlook: 'Very Strong',
      factors: [
        'Solar panel demand growing 20%+ annually',
        'EV and electronics driving industrial use',
        'Investment demand for silver bars/coins robust'
      ]
    },
    geopolitical: {
      risk: 'Medium',
      factors: [
        'Green energy transition policies',
        'Solar panel tariff disputes',
        'Mining regulations in Latin America'
      ]
    },
    weather: {
      impact: 'Low',
      details: 'Minimal direct weather impact on silver production'
    },
    supplyDemandBalance: 'Deficit',
    priceDrivers: [
      'Gold price correlation (historically 0.85+)',
      'Industrial demand from green energy sector',
      'Gold-to-silver ratio mean reversion',
      'Investment flows into silver ETFs'
    ],
    timestamp: new Date().toISOString()
  };
}

function getCrudeOilFundamentals(): CommodityFundamentals {
  return {
    inventory: {
      level: 'Below Average',
      change: -1.8,
      trend: 'Drawing',
      details: 'US commercial crude stocks below 5-year average, SPR at lowest levels'
    },
    production: {
      outlook: 'Constrained',
      factors: [
        'OPEC+ maintaining 2M bpd production cuts',
        'Saudi voluntary 1M bpd cut extended',
        'US shale growth slowing due to investor pressure'
      ]
    },
    consumption: {
      outlook: 'Moderate Growth',
      factors: [
        'China demand recovery key uncertainty',
        'Aviation fuel demand normalizing post-COVID',
        'EV adoption gradually impacting gasoline demand'
      ]
    },
    geopolitical: {
      risk: 'High',
      factors: [
        'Middle East tensions (Israel-Hamas, Iran)',
        'Russia-Ukraine war ongoing',
        'Red Sea shipping disruptions',
        'Venezuela sanctions dynamics'
      ]
    },
    weather: {
      impact: 'Seasonal',
      details: 'Hurricane season impacts Gulf of Mexico production; cold winters boost heating oil demand'
    },
    supplyDemandBalance: 'Deficit',
    priceDrivers: [
      'OPEC+ production decisions',
      'China economic data and demand outlook',
      'US inventory reports (weekly EIA data)',
      'Geopolitical risk premium',
      'Refinery maintenance schedules'
    ],
    timestamp: new Date().toISOString()
  };
}

function getNaturalGasFundamentals(): CommodityFundamentals {
  return {
    inventory: {
      level: 'Above Average',
      change: 3.5,
      trend: 'Building',
      details: 'US natural gas storage above 5-year average due to mild winter and strong production'
    },
    production: {
      outlook: 'Strong',
      factors: [
        'US production at record highs',
        'Associated gas from oil drilling adding supply',
        'LNG export capacity expanding'
      ]
    },
    consumption: {
      outlook: 'Weather Dependent',
      factors: [
        'Heating demand crucial in winter months',
        'Power generation demand steady',
        'LNG exports to Europe/Asia key variable'
      ]
    },
    geopolitical: {
      risk: 'Medium',
      factors: [
        'European energy security concerns',
        'LNG competition from Qatar/Australia',
        'Russia-Europe pipeline dynamics'
      ]
    },
    weather: {
      impact: 'High',
      details: 'Temperature deviations from normal significantly impact demand. Cold snaps can cause price spikes.'
    },
    supplyDemandBalance: 'Surplus',
    priceDrivers: [
      'Weather forecasts (HDD/CDD)',
      'Weekly EIA storage reports',
      'LNG export volumes',
      'Power generation switching dynamics',
      'Production growth trends'
    ],
    timestamp: new Date().toISOString()
  };
}

function getCopperFundamentals(): CommodityFundamentals {
  return {
    inventory: {
      level: 'Low',
      change: -3.2,
      trend: 'Declining',
      details: 'LME copper stocks at critically low levels, supporting prices'
    },
    production: {
      outlook: 'Challenged',
      factors: [
        'Chilean production disruptions (strikes, water issues)',
        'Peru political instability affecting output',
        'Congo emerging as major producer'
      ]
    },
    consumption: {
      outlook: 'Strong',
      factors: [
        'EV transition requires 4x copper vs ICE vehicles',
        'Grid infrastructure investment globally',
        'China property sector still a drag'
      ]
    },
    geopolitical: {
      risk: 'Medium',
      factors: [
        'China demand uncertainty',
        'Trade policy shifts',
        'Mining nationalism in Latin America',
        'Green energy subsidy policies'
      ]
    },
    weather: {
      impact: 'Moderate',
      details: 'Water availability in Chile affects mining operations; flooding can disrupt logistics'
    },
    supplyDemandBalance: 'Deficit',
    priceDrivers: [
      'China manufacturing PMI data',
      'LME warehouse stock levels',
      'EV sales and grid investment trends',
      'Mine supply disruptions',
      'USD strength (inverse correlation)'
    ],
    timestamp: new Date().toISOString()
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    console.log(`📊 Fetching fundamentals for ${symbol}...`);

    let fundamentals: CommodityFundamentals;

    // Get commodity-specific fundamentals
    if (symbol.includes('GOLD')) {
      fundamentals = getGoldFundamentals();
    } else if (symbol.includes('SILVER')) {
      fundamentals = getSilverFundamentals();
    } else if (symbol.includes('CRUDE')) {
      fundamentals = getCrudeOilFundamentals();
    } else if (symbol.includes('NATURAL')) {
      fundamentals = getNaturalGasFundamentals();
    } else if (symbol.includes('COPPER')) {
      fundamentals = getCopperFundamentals();
    } else {
      // Default generic fundamentals
      fundamentals = {
        inventory: { level: 'Normal', change: 0, trend: 'Stable', details: 'Inventory data not available' },
        production: { outlook: 'Stable', factors: ['Production levels steady'] },
        consumption: { outlook: 'Stable', factors: ['Demand levels normal'] },
        geopolitical: { risk: 'Low', factors: ['No major geopolitical concerns'] },
        weather: { impact: 'None', details: 'No weather-related impact expected' },
        supplyDemandBalance: 'Balanced',
        priceDrivers: ['Supply-demand dynamics', 'USD movements'],
        timestamp: new Date().toISOString()
      };
    }

    console.log(`✅ Fundamentals fetched for ${symbol}`);

    return new Response(JSON.stringify({
      success: true,
      data: fundamentals,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error fetching fundamentals:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
