import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/card';

interface SourceScoringProps {
  scoring: {
    json?: {
      verification_status?: string;
      confidence?: number;
      scores?: {
        overall?: number;
        reliability?: number;
        importance?: number;
        corroboration?: number;
        scope_clarity?: number;
        volatility_risk?: number;
      };
      claimed_source?: string;
      key_claims?: Array<{
        claim: string;
        verdict: string;
        notes?: string;
      }>;
      evidence?: Array<{
        source_name: string;
        url: string;
        strength: string;
      }>;
      caveats?: string[];
    };
    html?: string;
  };
}

export function NewsSourceScoringWidget({ scoring }: SourceScoringProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    setIsVisible(true);
  }, []);

  const data = scoring.json;
  if (!data) {
    // Fallback to HTML if no JSON
    return scoring.html ? (
      <div dangerouslySetInnerHTML={{ __html: scoring.html }} />
    ) : null;
  }

  const overall = data.scores?.overall || 0;
  const confidence = data.confidence || 0;
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.4 }
    }
  };

  const scoreBarVariants = {
    hidden: { width: 0 },
    visible: (score: number) => ({
      width: `${score}%`,
      transition: {
        duration: 1,
        delay: 0.3,
        ease: "easeOut"
      }
    })
  };

  const ringVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.8
      }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={containerVariants}
      className="w-full"
    >
      <Card className="p-6 bg-gradient-to-br from-card to-muted/10 border-border">
        {/* Header */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-border"
        >
          <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
            Status: {data.verification_status || 'Unknown'}
          </div>
          <div className="px-3 py-1 rounded-full bg-accent/10 text-accent-foreground text-sm font-medium border border-border">
            Confidence: {confidence}%
          </div>
          {data.claimed_source && (
            <div className="px-3 py-1 rounded-full bg-muted/50 text-muted-foreground text-sm font-medium border border-border">
              Source: {data.claimed_source}
            </div>
          )}
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Source Scoring Ring */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-col items-center justify-center p-6 bg-background border border-border rounded-xl shadow-sm"
          >
            <h3 className="text-base font-semibold mb-4 text-foreground">Source Scoring</h3>
            
            <motion.div
              variants={ringVariants}
              className="relative w-32 h-32 mb-4"
            >
              {/* Background circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="hsl(var(--muted))"
                  strokeWidth="8"
                  fill="none"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                  animate={{ 
                    strokeDashoffset: 2 * Math.PI * 56 * (1 - overall / 100),
                  }}
                  transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span 
                  className="text-4xl font-bold text-foreground"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                >
                  {overall}
                </motion.span>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Overall</span>
              </div>
            </motion.div>

            {/* Decision Meter */}
            <div className="text-center w-full">
              <div className="text-sm text-muted-foreground mb-1">Decision</div>
              <motion.div 
                className="text-xl font-bold text-chart-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                {overall >= 75 ? 'Push' : overall >= 50 ? 'Highlight' : overall >= 25 ? 'Normal' : 'Low'}
              </motion.div>
              
              {/* Meter line */}
              <div className="relative w-full max-w-xs mx-auto h-1.5 bg-gradient-to-r from-destructive via-chart-3 via-chart-2 to-primary rounded-full mt-4">
                <motion.div
                  className="absolute top-0 w-1 h-3 bg-foreground rounded-sm shadow-md"
                  style={{ left: `${overall}%`, transform: 'translateX(-50%) translateY(-2px)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                />
              </div>
              <div className="flex justify-between w-full max-w-xs mx-auto text-xs text-muted-foreground mt-1">
                <span>Low</span>
                <span>Norm</span>
                <span>High</span>
                <span>Push</span>
              </div>
            </div>
          </motion.div>

          {/* Detailed Metrics */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-col justify-center"
          >
            <h3 className="text-base font-semibold mb-4 pb-2 border-b border-border">Detailed Metrics</h3>
            
            <div className="space-y-3">
              {Object.entries(data.scores || {}).map(([key, value], index) => {
                if (key === 'overall') return null;
                const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                const isRisk = key === 'volatility_risk';
                
                return (
                  <motion.div
                    key={key}
                    variants={itemVariants}
                    custom={index}
                  >
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground">{label}</span>
                      <span className="font-bold text-foreground">{value}/100</span>
                    </div>
                    <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden border border-border">
                      <motion.div
                        className="h-full bg-chart-2 rounded-full"
                        custom={value}
                        variants={scoreBarVariants}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Claims & Evidence Grid */}
        {(data.key_claims?.length || data.evidence?.length) && (
          <motion.div 
            variants={itemVariants}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Key Claims */}
            {data.key_claims && data.key_claims.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Key Claims Verified
                </h3>
                <div className="space-y-2">
                  {data.key_claims.map((claim, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + i * 0.1 }}
                      className="p-3 border border-border bg-muted/10 rounded-lg"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <strong className="text-sm flex-1">{claim.claim}</strong>
                        <span className={`px-2 py-0.5 rounded text-xs ml-2 ${
                          claim.verdict === 'confirmed' 
                            ? 'bg-chart-2/20 text-chart-2' 
                            : 'bg-chart-1/20 text-chart-1'
                        }`}>
                          {claim.verdict}
                        </span>
                      </div>
                      {claim.notes && (
                        <p className="text-xs text-muted-foreground">{claim.notes}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence */}
            {data.evidence && data.evidence.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-chart-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  Supporting Evidence
                </h3>
                <ul className="space-y-2">
                  {data.evidence.map((ev, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1 + i * 0.1 }}
                      className="p-2 border border-border rounded-lg bg-background text-sm"
                    >
                      <span className={`px-2 py-0.5 rounded text-xs mr-2 ${
                        ev.strength === 'high' 
                          ? 'bg-chart-4/20 text-chart-4' 
                          : 'bg-muted/50 text-muted-foreground'
                      }`}>
                        {ev.strength}
                      </span>
                      <strong className="mx-1">{ev.source_name}</strong>
                      <a 
                        href={ev.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary text-xs hover:underline"
                      >
                        [Link]
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* Caveats */}
        {data.caveats && data.caveats.length > 0 && (
          <motion.div
            variants={itemVariants}
            className="mt-6 p-4 border-l-4 border-chart-4 bg-chart-4/10 rounded"
          >
            <h4 className="text-sm font-semibold text-chart-4 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Caveats / Notes
            </h4>
            <ul className="text-sm space-y-1 pl-5 list-disc text-foreground">
              {data.caveats.map((caveat, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 + i * 0.1 }}
                >
                  {caveat}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}
