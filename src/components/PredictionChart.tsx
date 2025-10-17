import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

const historicalData = [
  { date: "Jan 1", actual: 2300, predicted: 2310 },
  { date: "Jan 8", actual: 2320, predicted: 2325 },
  { date: "Jan 15", actual: 2340, predicted: 2338 },
  { date: "Jan 22", actual: 2360, predicted: 2365 },
  { date: "Jan 29", actual: 2380, predicted: 2382 },
  { date: "Feb 5", actual: 2400, predicted: 2398 },
  { date: "Feb 12", actual: 2420, predicted: 2425 },
];

const futureData = [
  { date: "Feb 12", price: 2420 },
  { date: "Feb 19", price: 2445 },
  { date: "Feb 26", price: 2468 },
  { date: "Mar 5", price: 2490 },
  { date: "Mar 12", price: 2515 },
];

const PredictionChart = () => {
  return (
    <section id="predictions" className="py-20 px-4 bg-background/50">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            AI-Powered <span className="text-gradient">Predictions</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Advanced machine learning models forecasting future prices
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
          {/* Historical vs Predicted */}
          <Card className="glass-strong border-border">
            <CardHeader>
              <CardTitle>Historical Performance</CardTitle>
              <CardDescription>Actual vs Predicted Prices (Last 7 Weeks)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="predicted" 
                    stroke="hsl(var(--success))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--success))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-primary"></div>
                  <span className="text-sm text-muted-foreground">Actual Price</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-success"></div>
                  <span className="text-sm text-muted-foreground">Predicted Price</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Future Predictions */}
          <Card className="glass-strong border-border">
            <CardHeader>
              <CardTitle>Future Forecast</CardTitle>
              <CardDescription>AI Predictions for Next 5 Weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={futureData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="hsl(var(--success))" 
                    fillOpacity={1} 
                    fill="url(#colorPrice)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-4 p-4 glass rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Expected Price (5 weeks)</span>
                  <span className="text-2xl font-bold text-success">₹2,515.00</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-muted-foreground">Potential Gain</span>
                  <span className="text-lg font-semibold text-success">+3.93%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12 max-w-7xl mx-auto">
          <Card className="glass-strong border-border">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Model Accuracy</p>
                <p className="text-3xl font-bold text-success">94.5%</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-strong border-border">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Avg Error</p>
                <p className="text-3xl font-bold text-primary">±2.1%</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-strong border-border">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Data Points</p>
                <p className="text-3xl font-bold text-accent">10K+</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-strong border-border">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Last Updated</p>
                <p className="text-3xl font-bold text-foreground">2m ago</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default PredictionChart;
