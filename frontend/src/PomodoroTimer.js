import React, { useState, useRef, useEffect } from 'react';

const DEFAULT_SESSION = 66; // minutes
const DEFAULT_BREAK = 5; // minutes
const DEFAULT_LONG_BREAK = 15; // minutes
const CYCLES_BEFORE_LONG_BREAK = 4;
const DEFAULT_CUSTOM = 66; // minutes

const beepUrl = "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";

function getTodayString() {
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

function PomodoroTimer() {
  const [sessionLength, setSessionLength] = useState(DEFAULT_SESSION);
  const [breakLength, setBreakLength] = useState(DEFAULT_BREAK);
  const [longBreakLength, setLongBreakLength] = useState(DEFAULT_LONG_BREAK);
  const [isRunning, setIsRunning] = useState(false);
  const [isSession, setIsSession] = useState(true);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SESSION * 60);
  const [cycles, setCycles] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('pomodoroHistory');
    return saved ? (JSON.parse(saved ?? "null") ?? null) : {};
  });
  const [customTime, setCustomTime] = useState(DEFAULT_CUSTOM);
  const [customLeft, setCustomLeft] = useState(DEFAULT_CUSTOM * 60);
  const [customRunning, setCustomRunning] = useState(false);
  const [customStarted, setCustomStarted] = useState(false);
  const intervalRef = useRef(null);
  const customIntervalRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pomodoroHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    setTimeLeft((isSession ? sessionLength : (cycles % CYCLES_BEFORE_LONG_BREAK === 0 && cycles !== 0 ? longBreakLength : breakLength)) * 60);
    // eslint-disable-next-line
  }, [sessionLength, breakLength, longBreakLength, isSession]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSwitch();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line
  }, [isRunning]);

  // Custom timer effect
  useEffect(() => {
    if (customRunning) {
      customIntervalRef.current = setInterval(() => {
        setCustomLeft(prev => {
          if (prev <= 1) {
            if (audioRef.current) audioRef.current.play();
            setCustomRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (customIntervalRef.current) {
      clearInterval(customIntervalRef.current);
    }
    return () => clearInterval(customIntervalRef.current);
  }, [customRunning]);

  // Fullscreen API for Focus Mode
  useEffect(() => {
    if (focusMode && timerRef.current) {
      if (timerRef.current.requestFullscreen) {
        timerRef.current.requestFullscreen();
      } else if (timerRef.current.webkitRequestFullscreen) {
        timerRef.current.webkitRequestFullscreen();
      } else if (timerRef.current.mozRequestFullScreen) {
        timerRef.current.mozRequestFullScreen();
      } else if (timerRef.current.msRequestFullscreen) {
        timerRef.current.msRequestFullscreen();
      }
    } else if (!focusMode && document.fullscreenElement) {
      document.exitFullscreen && document.exitFullscreen();
    }
  }, [focusMode]);

  // Request notification permission on mount if not granted
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    }
  }, []);

  const showNotification = (title, body) => {
    if (notificationsEnabled && notificationPermission === 'granted') {
      new Notification(title, { body });
    }
  };

  const handleSwitch = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
    if (isSession) {
      setIsSession(false);
      setTimeLeft((cycles % CYCLES_BEFORE_LONG_BREAK === 0 && cycles !== 0 ? longBreakLength : breakLength) * 60);
      showNotification('Break Time!', 'Take a break!');
      // Record completed Pomodoro (work session)
      const today = getTodayString();
      setHistory(prev => {
        const dayArr = prev[today] ? [...prev[today]] : [];
        dayArr.push({
          type: 'work',
          timestamp: Date.now()
        });
        return { ...prev, [today]: dayArr };
      });
    } else {
      setIsSession(true);
      setCycles(c => c + 1);
      setTimeLeft(sessionLength * 60);
      showNotification('Session Started', 'Back to work!');
    }
  };

  const handleStartPause = () => {
    setIsRunning(r => !r);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsSession(true);
    setCycles(0);
    setTimeLeft(sessionLength * 60);
  };

  const handleSettingsSave = (e) => {
    e.preventDefault();
    setShowSettings(false);
    setIsRunning(false);
    setIsSession(true);
    setCycles(0);
    setTimeLeft(sessionLength * 60);
  };

  const handleFocusMode = () => {
    setFocusMode(true);
  };

  const handleExitFocusMode = () => {
    setFocusMode(false);
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleToggleNotifications = () => {
    if (!notificationsEnabled) {
      // Enable: request permission if needed
      if (notificationPermission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
          if (permission === 'granted') {
            setNotificationsEnabled(true);
          }
        });
      } else if (notificationPermission === 'granted') {
        setNotificationsEnabled(true);
      }
    } else {
      // Disable
      setNotificationsEnabled(false);
    }
  };

  const handleClearHistory = () => {
    setHistory({});
  };

  const handleCustomStart = () => {
    setCustomLeft(customTime * 60);
    setCustomRunning(true);
    setCustomStarted(true);
  };

  const handleCustomPause = () => setCustomRunning(false);

  const handleCustomResume = () => setCustomRunning(true);

  const handleCustomReset = () => {
    setCustomRunning(false);
    setCustomStarted(false);
    setCustomLeft(customTime * 60);
  };

  const handleCustomTimeChange = (e) => {
    const val = Math.max(1, Number(e.target.value));
    setCustomTime(val);
    setCustomLeft(val * 60);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Stats for today
  const today = getTodayString();
  const todayHistory = history[today] || [];
  const todayPomodoros = todayHistory.filter(h => h.type === 'work').length;
  const todayFocusMinutes = todayPomodoros * sessionLength;

  return (
    <div className="SithPomodoro" ref={timerRef} style={focusMode ? {zIndex: 9999, background: '#1a0000', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'} : {}}>
      <div style={{marginBottom: 10}}>
        <button className="SithButton" onClick={handleToggleNotifications}>
          {notificationsEnabled ? 'Disable Desktop Notifications' : 'Enable Desktop Notifications'}
        </button>
        {notificationPermission === 'denied' && (
          <span style={{color: '#ff2d2d', marginLeft: 8}}>Notifications are blocked in your browser settings.</span>
        )}
      </div>
      <div style={{fontSize: 40, textAlign: 'center', color: isSession ? '#fff' : '#ff2d2d', textShadow: '0 0 8px #ff2d2d88'}}>
        {formatTime(timeLeft)}
      </div>
      <div style={{textAlign: 'center', margin: '0.5rem 0 1rem 0'}}>
        <span style={{fontWeight: 'bold', color: '#ff2d2d'}}>{isSession ? 'Session' : (cycles % CYCLES_BEFORE_LONG_BREAK === 0 && cycles !== 0 ? 'Long Break' : 'Break')}</span>
      </div>
      <div style={{display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10}}>
        <button className="SithButton" onClick={handleStartPause}>{isRunning ? 'Pause' : 'Start'}</button>
        <button className="SithButton" onClick={handleReset}>Reset</button>
        <button className="SithButton" onClick={() => setShowSettings(s => !s)}>Settings</button>
        {!focusMode && <button className="SithButton" onClick={handleFocusMode}>Focus Mode</button>}
        {focusMode && <button className="SithButton" onClick={handleExitFocusMode}>Exit Focus Mode</button>}
      </div>
      <div style={{textAlign: 'center', marginBottom: 10, color: '#fff'}}>
        <span>Cycles completed: <b>{cycles}</b></span>
      </div>
      {showSettings && (
        <form onSubmit={handleSettingsSave} style={{background: '#2d0606', padding: 10, borderRadius: 8, border: '1px solid #ff2d2d', marginBottom: 10, color: '#fff'}}>
          <div style={{marginBottom: 8}}>
            <label>Session (min): <input type="number" min="1" max="60" value={sessionLength} onChange={e => setSessionLength(Number(e.target.value))} style={{background: '#1a0000', color: '#fff', border: '1px solid #ff2d2d', borderRadius: 4, marginLeft: 4}} /></label>
          </div>
          <div style={{marginBottom: 8}}>
            <label>Break (min): <input type="number" min="1" max="30" value={breakLength} onChange={e => setBreakLength(Number(e.target.value))} style={{background: '#1a0000', color: '#fff', border: '1px solid #ff2d2d', borderRadius: 4, marginLeft: 4}} /></label>
          </div>
          <div style={{marginBottom: 8}}>
            <label>Long Break (min): <input type="number" min="1" max="60" value={longBreakLength} onChange={e => setLongBreakLength(Number(e.target.value))} style={{background: '#1a0000', color: '#fff', border: '1px solid #ff2d2d', borderRadius: 4, marginLeft: 4}} /></label>
          </div>
          <button className="SithButton" type="submit">Save</button>
        </form>
      )}
      <div style={{margin: '2rem 0 0 0', borderTop: '1px solid #ff2d2d', paddingTop: 16}}>
        <h3 style={{color: '#ff2d2d'}}>Custom Timer</h3>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8}}>
          <label>Minutes: <input type="number" min="1" value={customTime} onChange={handleCustomTimeChange} style={{width: 60, background: '#1a0000', color: '#fff', border: '1px solid #ff2d2d', borderRadius: 4, marginLeft: 4}} /></label>
          {!customRunning && !customStarted && <button className="SithButton" onClick={handleCustomStart}>Start</button>}
          {customRunning && <button className="SithButton" onClick={handleCustomPause}>Pause</button>}
          {!customRunning && customStarted && customLeft > 0 && <button className="SithButton" onClick={handleCustomResume}>Resume</button>}
          {(customStarted && <button className="SithButton" onClick={handleCustomReset}>Reset</button>)}
        </div>
        {customStarted && (
          <div style={{fontSize: 32, color: '#fff', marginTop: 8}}>{formatTime(customLeft)}</div>
        )}
      </div>
      <audio ref={audioRef} src={beepUrl} preload="auto" />
    </div>
  );
}

export default PomodoroTimer; 