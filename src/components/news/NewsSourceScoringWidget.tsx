import { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
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
  const controls = useAnimation();
  
  useEffect(() => {
    setIsVisible(true);
    controls.start("visible");
  }, [controls]);

  const data = scoring.json;
  if (!data) {
    return scoring.html ? (
      <div dangerouslySetInnerHTML={{ __html: scoring.html }} />
    ) : null;
  }

  const overall = data.scores?.overall || 0;
  const confidence = data.confidence || 0;
  
  // Get color theme based on score
  const getScoreColor = (score: number) => {
    if (score >= 75) return { color: 'hsl(var(--chart-2))', glow: 'rgba(34, 197, 94, 0.3)' }; // green
    if (score >= 50) return { color: 'hsl(var(--chart-4))', glow: 'rgba(59, 130, 246, 0.3)' }; // blue
    if (score >= 25) return { color: 'hsl(var(--chart-3))', glow: 'rgba(251, 191, 36, 0.3)' }; // yellow
    return { color: 'hsl(var(--destructive))', glow: 'rgba(239, 68, 68, 0.3)' }; // red
  };

  const scoreTheme = getScoreColor(overall);
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const floatVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 80,
        damping: 12
      }
    }
  };

  const scoreBarVariants = {
    hidden: { scaleX: 0, opacity: 0 },
    visible: (score: number) => ({
      scaleX: 1,
      opacity: 1,
      transition: {
        scaleX: { duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.3, delay: 0.5 }
      }
    })
  };

  const ringVariants = {
    hidden: { scale: 0, rotate: -90, opacity: 0 },
    visible: {
      scale: 1,
      rotate: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 60,
        damping: 10,
        duration: 1.2
      }
    }
  };

  const pulseVariants = {
    pulse: {
      scale: [1, 1.05, 1],
      opacity: [0.5, 0.8, 0.5],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={containerVariants}
      className="w-full relative"
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none opacity-30">
        <motion.div
          className="absolute -inset-[100%] opacity-50"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${scoreTheme.glow}, transparent 50%)`
          }}
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      <Card className="relative backdrop-blur-sm bg-card/95 border-2 shadow-2xl overflow-hidden">
        {/* Glass effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        <div className="relative p-6">
          {/* Header badges */}
          <motion.div 
            variants={floatVariants}
            className="flex flex-wrap gap-2 mb-8"
          >
            <motion.div 
              className="px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 text-primary text-sm font-bold border-2 border-primary/30 shadow-lg"
              whileHover={{ scale: 1.05, boxShadow: `0 0 20px ${scoreTheme.glow}` }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              ✓ {data.verification_status || 'Unknown'}
            </motion.div>
            <motion.div 
              className="px-4 py-2 rounded-full bg-gradient-to-r from-accent/20 to-accent/10 text-accent-foreground text-sm font-semibold border-2 border-accent/30"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              🎯 {confidence}% confidence
            </motion.div>
            {data.claimed_source && (
              <motion.div 
                className="px-4 py-2 rounded-full bg-gradient-to-r from-muted/30 to-muted/20 text-foreground text-sm font-medium border-2 border-muted/40"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                📰 {data.claimed_source}
              </motion.div>
            )}
          </motion.div>

          {/* Main Grid - Score Ring & Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Source Scoring Ring - Redesigned */}
            <motion.div 
              variants={floatVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative"
            >
              <div className="p-8 bg-gradient-to-br from-background/80 via-background/60 to-background/40 backdrop-blur-lg border-2 border-border/50 rounded-2xl shadow-xl">
                {/* Glow effect for high scores */}
                {overall >= 75 && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      boxShadow: `0 0 60px ${scoreTheme.glow}, inset 0 0 60px ${scoreTheme.glow}`
                    }}
                    variants={pulseVariants}
                    animate="pulse"
                  />
                )}
                
                <h3 className="text-lg font-bold mb-6 text-center bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Source Scoring
                </h3>
                
                <div className="flex flex-col items-center justify-center">
                  {/* Particle ring background */}
                  <div className="relative mb-6">
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: scoreTheme.color,
                          left: '50%',
                          top: '50%',
                          transformOrigin: '0 0',
                        }}
                        animate={{
                          rotate: [0, 360],
                          scale: [1, 1.5, 1],
                          opacity: [0.3, 0.7, 0.3],
                          x: Math.cos((i / 12) * Math.PI * 2) * 80 - 4,
                          y: Math.sin((i / 12) * Math.PI * 2) * 80 - 4,
                        }}
                        transition={{
                          duration: 3 + i * 0.2,
                          repeat: Infinity,
                          ease: "linear",
                          delay: i * 0.1
                        }}
                      />
                    ))}
                    
                    {/* Main scoring ring */}
                    <motion.div
                      variants={ringVariants}
                      className="relative w-40 h-40"
                    >
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                        {/* Background ring */}
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="hsl(var(--muted))"
                          strokeWidth="12"
                          fill="none"
                          opacity="0.2"
                        />
                        {/* Animated progress ring */}
                        <motion.circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke={scoreTheme.color}
                          strokeWidth="12"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 70}`}
                          initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
                          animate={{ 
                            strokeDashoffset: 2 * Math.PI * 70 * (1 - overall / 100),
                          }}
                          transition={{ 
                            duration: 2, 
                            delay: 0.5, 
                            ease: [0.16, 1, 0.3, 1]
                          }}
                          style={{
                            filter: `drop-shadow(0 0 8px ${scoreTheme.glow})`
                          }}
                        />
                      </svg>
                      
                      {/* Center score display */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.div
                          className="text-6xl font-black bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent"
                          initial={{ opacity: 0, scale: 0, rotate: -180 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          transition={{ 
                            delay: 1, 
                            type: "spring",
                            stiffness: 200,
                            damping: 10
                          }}
                        >
                          {overall}
                        </motion.div>
                        <motion.div 
                          className="text-xs uppercase tracking-widest text-muted-foreground font-bold mt-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1.3 }}
                        >
                          Overall
                        </motion.div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Decision meter */}
                  <motion.div 
                    className="w-full max-w-xs"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.5 }}
                  >
                    <div className="text-center mb-3">
                      <div className="text-sm text-muted-foreground mb-2 font-semibold">DECISION</div>
                      <motion.div 
                        className="text-2xl font-black"
                        style={{ color: scoreTheme.color }}
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.5, delay: 1.7 }}
                      >
                        {overall >= 75 ? '🚀 PUSH' : overall >= 50 ? '⭐ HIGHLIGHT' : overall >= 25 ? '📌 NORMAL' : '⚠️ LOW'}
                      </motion.div>
                    </div>
                    
                    {/* Gradient meter bar */}
                    <div className="relative h-3 bg-gradient-to-r from-destructive via-chart-3 via-chart-4 to-chart-2 rounded-full overflow-hidden shadow-lg">
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                      <motion.div
                        className="absolute top-0 w-2 h-5 bg-foreground rounded-sm shadow-xl"
                        style={{ 
                          left: `${overall}%`,
                          transform: 'translateX(-50%) translateY(-1px)',
                          boxShadow: `0 0 10px ${scoreTheme.glow}`
                        }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1.8, type: "spring" }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2 font-semibold">
                      <span>0</span>
                      <span>25</span>
                      <span>50</span>
                      <span>75</span>
                      <span>100</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Detailed Metrics - Redesigned */}
            <motion.div 
              variants={floatVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="p-8 bg-gradient-to-br from-background/80 via-background/60 to-background/40 backdrop-blur-lg border-2 border-border/50 rounded-2xl shadow-xl"
            >
              <h3 className="text-lg font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-2">
                📊 Detailed Metrics
              </h3>
              
              <div className="space-y-5">
                {Object.entries(data.scores || {}).map(([key, value], index) => {
                  if (key === 'overall') return null;
                  
                  const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  const metricColor = getScoreColor(value as number);
                  const isHighScore = (value as number) >= 75;
                  
                  return (
                    <motion.div
                      key={key}
                      variants={floatVariants}
                      whileHover={{ x: 5, scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 400 }}
                      className="relative group"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
                          {label}
                        </span>
                        <motion.span 
                          className="font-black text-lg tabular-nums"
                          style={{ color: metricColor.color }}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.7 + index * 0.1, type: "spring" }}
                        >
                          {value}
                        </motion.span>
                      </div>
                      
                      <div className="relative h-3 bg-muted/20 rounded-full overflow-hidden backdrop-blur-sm border border-border/30">
                        {/* Animated shimmer effect */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear",
                            delay: index * 0.3
                          }}
                        />
                        
                        {/* Progress bar */}
                        <motion.div
                          className="h-full rounded-full relative"
                          style={{
                            backgroundColor: metricColor.color,
                            boxShadow: `0 0 10px ${metricColor.glow}`,
                            transformOrigin: "left"
                          }}
                          custom={value}
                          variants={scoreBarVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <div 
                            className="absolute inset-0 rounded-full"
                            style={{
                              width: `${value}%`,
                              background: `linear-gradient(90deg, ${metricColor.color}, transparent)`
                            }}
                          />
                        </motion.div>
                        
                        {/* Pulse effect for high scores */}
                        {isHighScore && (
                          <motion.div
                            className="absolute inset-0 rounded-full"
                            style={{
                              backgroundColor: metricColor.color,
                              width: `${value}%`
                            }}
                            animate={{
                              opacity: [0, 0.3, 0],
                              scale: [1, 1.1, 1]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: index * 0.2
                            }}
                          />
                        )}
                      </div>
                      
                      {/* Score indicator line */}
                      <motion.div
                        className="absolute right-0 top-0 w-0.5 h-full rounded-full opacity-0 group-hover:opacity-100"
                        style={{ backgroundColor: metricColor.color }}
                        initial={{ scaleY: 0 }}
                        whileHover={{ scaleY: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Claims & Evidence - Redesigned */}
          {(data.key_claims?.length || data.evidence?.length) && (
            <motion.div 
              variants={floatVariants}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Key Claims */}
              {data.key_claims && data.key_claims.length > 0 && (
                <div className="p-6 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-lg border-2 border-border/50 rounded-2xl shadow-xl">
                  <h3 className="text-lg font-bold mb-5 flex items-center gap-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Key Claims
                  </h3>
                  
                  <div className="space-y-3">
                    {data.key_claims.map((claim, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -30, rotateY: -15 }}
                        animate={{ opacity: 1, x: 0, rotateY: 0 }}
                        transition={{ 
                          delay: 1.2 + i * 0.15,
                          type: "spring",
                          stiffness: 100
                        }}
                        whileHover={{ 
                          scale: 1.02, 
                          x: 5,
                          boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
                        }}
                        className="group p-4 border-2 border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl backdrop-blur-sm hover:border-primary/50 transition-all duration-300 cursor-default"
                      >
                        <div className="flex justify-between items-start gap-3 mb-2">
                          <strong className="text-sm flex-1 text-foreground/90 group-hover:text-foreground transition-colors leading-relaxed">
                            {claim.claim}
                          </strong>
                          <motion.span 
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-sm ${
                              claim.verdict === 'confirmed' 
                                ? 'bg-chart-2/20 text-chart-2 border-2 border-chart-2/30' 
                                : 'bg-chart-1/20 text-chart-1 border-2 border-chart-1/30'
                            }`}
                            whileHover={{ scale: 1.1 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            {claim.verdict === 'confirmed' ? '✓' : '○'} {claim.verdict}
                          </motion.span>
                        </div>
                        {claim.notes && (
                          <motion.p 
                            className="text-xs text-muted-foreground leading-relaxed pl-3 border-l-2 border-muted/30"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.4 + i * 0.15 }}
                          >
                            {claim.notes}
                          </motion.p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence */}
              {data.evidence && data.evidence.length > 0 && (
                <div className="p-6 bg-gradient-to-br from-background/80 to-background/60 backdrop-blur-lg border-2 border-border/50 rounded-2xl shadow-xl">
                  <h3 className="text-lg font-bold mb-5 flex items-center gap-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    Evidence
                  </h3>
                  
                  <div className="space-y-3">
                    {data.evidence.map((ev, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -30, rotateY: -15 }}
                        animate={{ opacity: 1, x: 0, rotateY: 0 }}
                        transition={{ 
                          delay: 1.3 + i * 0.15,
                          type: "spring",
                          stiffness: 100
                        }}
                        whileHover={{ 
                          scale: 1.02,
                          x: 5,
                          boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
                        }}
                        className="group p-4 border-2 border-border/50 bg-gradient-to-br from-background/60 to-background/30 rounded-xl backdrop-blur-sm hover:border-chart-4/50 transition-all duration-300"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <motion.span 
                            className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                              ev.strength === 'high' 
                                ? 'bg-chart-4/20 text-chart-4 border-2 border-chart-4/30' 
                                : 'bg-muted/50 text-muted-foreground border-2 border-muted/30'
                            }`}
                            whileHover={{ scale: 1.1 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            {ev.strength === 'high' ? '⚡' : '○'} {ev.strength}
                          </motion.span>
                          <strong className="text-sm text-foreground/90 group-hover:text-foreground transition-colors">
                            {ev.source_name}
                          </strong>
                          <motion.a 
                            href={ev.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="ml-auto px-3 py-1 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 rounded-full transition-all border-2 border-primary/20 hover:border-primary/40"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            🔗 View
                          </motion.a>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Caveats - Redesigned */}
          {data.caveats && data.caveats.length > 0 && (
            <motion.div
              variants={floatVariants}
              whileHover={{ y: -3, scale: 1.01 }}
              className="mt-6 p-6 border-l-4 rounded-2xl backdrop-blur-lg bg-gradient-to-r from-chart-3/20 via-chart-3/10 to-transparent border-chart-3 shadow-xl relative overflow-hidden"
            >
              {/* Animated background pattern */}
              <motion.div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, hsl(var(--chart-3)) 10px, hsl(var(--chart-3)) 20px)'
                }}
                animate={{ x: [0, 20, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              />
              
              <div className="relative">
                <h4 className="text-base font-bold mb-4 flex items-center gap-2 text-chart-3">
                  <motion.svg 
                    className="w-5 h-5" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </motion.svg>
                  Important Caveats
                </h4>
                
                <ul className="space-y-2 pl-4">
                  {data.caveats.map((caveat, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.6 + i * 0.1, type: "spring" }}
                      whileHover={{ x: 5, scale: 1.02 }}
                      className="text-sm text-foreground/90 hover:text-foreground list-disc marker:text-chart-3 leading-relaxed transition-all cursor-default"
                    >
                      {caveat}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
