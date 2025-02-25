import React, { useState } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import SplitList from './SplitList';
import ExpenseSplitter from './ExpenseSplitter';

export interface Split {
  id: string;
  name: string;
  people: Person[];
  settlements: Settlement[];
  createdAt: string;
  currency?: string;
}

export interface Person {
  name: string;
  amount: number;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface NavigationProps {
  navigate: (screenName: string, params?: any) => void;
  goBack: () => void;
}

export interface RouteProps {
  params: {
    splitId?: string;
  };
}

const { width } = Dimensions.get('window');

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<string>('SplitList');
  const [currentSplitId, setCurrentSplitId] = useState<string | null>(null);
  const [slideAnim] = useState(new Animated.Value(width));
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Navigation functions that we'll pass to our screens
  const navigation: NavigationProps = {
    navigate: (screenName: string, params?: any) => {
      if (screenName === 'ExpenseSplitter') {
        // Slide in the ExpenseSplitter from right
        if (params && params.splitId) {
          setCurrentSplitId(params.splitId);
        }
        setCurrentScreen(screenName);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 12
        }).start();
      } else {
        // Just switch to SplitList
        setCurrentScreen(screenName);
      }
    },
    goBack: () => {
      // Slide out the ExpenseSplitter to the right
      Animated.spring(slideAnim, {
        toValue: width,
        useNativeDriver: true,
        tension: 70,
        friction: 12
      }).start(() => {
        setCurrentScreen('SplitList');
        // Trigger a refresh of the SplitList when returning
        setRefreshTrigger(prev => prev + 1);
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* SplitList is always rendered in the background */}
      <View style={styles.screenContainer}>
        <SplitList navigation={navigation} refreshTrigger={refreshTrigger} />
      </View>
      
      {/* ExpenseSplitter slides in from the right */}
      {currentScreen === 'ExpenseSplitter' && (
        <Animated.View 
          style={[
            styles.overlayContainer,
            { transform: [{ translateX: slideAnim }] }
          ]}
        >
          <ExpenseSplitter 
            navigation={navigation} 
            route={{ params: { splitId: currentSplitId ?? undefined } }}  
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  }
}); 