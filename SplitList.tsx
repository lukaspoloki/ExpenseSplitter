import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  SafeAreaView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProps, Split } from './App';

const { width, height } = Dimensions.get('window');

interface SplitListProps {
  navigation: NavigationProps;
  refreshTrigger?: number;
}

export default function SplitList({ navigation, refreshTrigger = 0 }: SplitListProps) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [newSplitName, setNewSplitName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    loadSplits();
    // Animate in the content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [refreshTrigger]);

  const loadSplits = async () => {
    try {
      setIsLoading(true);
      const savedSplits = await AsyncStorage.getItem('splits');
      if (savedSplits) {
        setSplits(JSON.parse(savedSplits));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load saved splits');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSplits = async (updatedSplits: Split[]) => {
    try {
      await AsyncStorage.setItem('splits', JSON.stringify(updatedSplits));
    } catch (error) {
      Alert.alert('Error', 'Failed to save splits');
      console.error(error);
    }
  };

  const createNewSplit = () => {
    if (!newSplitName.trim()) {
      Alert.alert('Error', 'Please enter a split name');
      return;
    }

    // Check for duplicate split names
    if (splits.some(split => split.name.toLowerCase() === newSplitName.trim().toLowerCase())) {
      Alert.alert('Error', 'A split with this name already exists');
      return;
    }

    const newSplit: Split = {
      id: Date.now().toString(),
      name: newSplitName.trim(),
      people: [],
      settlements: [],
      createdAt: new Date().toISOString(),
      currency: 'USD',
    };

    const updatedSplits = [...splits, newSplit];
    setSplits(updatedSplits);
    saveSplits(updatedSplits);
    setNewSplitName('');
    
    // Navigate to the expense splitter with the new split
    navigation.navigate('ExpenseSplitter', { splitId: newSplit.id });
  };

  const openSplit = (split: Split) => {
    navigation.navigate('ExpenseSplitter', { splitId: split.id });
  };

  const deleteSplit = (splitId: string) => {
    Alert.alert(
      'Delete Split',
      'Are you sure you want to delete this split?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          const updatedSplits = splits.filter(split => split.id !== splitId);
          saveSplits(updatedSplits);
          setSplits(updatedSplits);
        }},
      ],
    );
  };    

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  const getSplitSummary = (split: Split) => {
    const totalAmount = split.people.reduce((sum, person) => sum + person.amount, 0);
    const peopleCount = split.people.length;
    return { totalAmount, peopleCount };
  };

  const renderSplitItem = ({ item, index }: { item: Split; index: number }) => {
    const { totalAmount, peopleCount } = getSplitSummary(item);
    const currencySymbol = item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : item.currency === 'GBP' ? '£' : item.currency || 'USD';
    
    return (
      <Animated.View
        style={[
          styles.splitItemWrapper,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 50],
                })
              }
            ]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.splitItem}
          onPress={() => openSplit(item)}
          onLongPress={() => deleteSplit(item.id)}
          activeOpacity={0.8}
        >
          <View style={styles.splitGlassOverlay} />
          <View style={styles.splitContent}>
            <View style={styles.splitHeader}>
              <View style={styles.splitIconContainer}>
                <Ionicons name="receipt-outline" size={24} color="#6366f1" />
              </View>
              <View style={styles.splitInfo}>
                <Text style={styles.splitName}>{item.name}</Text>
                <Text style={styles.splitDate}>{formatDate(item.createdAt)}</Text>
              </View>
              <TouchableOpacity 
                style={styles.moreButton}
                onPress={() => deleteSplit(item.id)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.splitStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{peopleCount}</Text>
                <Text style={styles.statLabel}>People</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{currencySymbol}{totalAmount.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {peopleCount > 0 ? `${currencySymbol}${(totalAmount / peopleCount).toFixed(2)}` : `${currencySymbol}0`}
                </Text>
                <Text style={styles.statLabel}>Per Person</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      
      {/* Background gradient */}
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        start={[0, 0]}
        end={[1, 1]}
        style={styles.backgroundGradient}
      />
      
      {/* Floating orbs for background decoration */}
      <View style={[styles.floatingOrb, styles.orb1]} />
      <View style={[styles.floatingOrb, styles.orb2]} />
      <View style={[styles.floatingOrb, styles.orb3]} />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Glass morphism header */}
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.headerGlass} />
          <View style={styles.headerContent}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Expense Splitter</Text>
              <Text style={styles.headerSubtitle}>Split bills fairly with friends</Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="wallet-outline" size={32} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Glass morphism input card */}
          <View style={styles.inputCard}>
            <View style={styles.inputCardGlass} />
            <View style={styles.inputContainer}>
              <Text style={styles.inputCardTitle}>Create New Split</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="add-circle-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter split name..."
                  placeholderTextColor="rgba(107, 114, 128, 0.6)"
                  value={newSplitName}
                  onChangeText={setNewSplitName}
                  returnKeyType="done"
                  onSubmitEditing={createNewSplit}
                />
              </View>
              <TouchableOpacity 
                style={[styles.createButton, !newSplitName.trim() && styles.createButtonDisabled]}
                onPress={createNewSplit}
                disabled={!newSplitName.trim()}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={!newSplitName.trim() ? ['#d1d5db', '#9ca3af'] : ['#6366f1', '#8b5cf6']}
                  start={[0, 0]}
                  end={[1, 0]}
                  style={styles.createButtonGradient}
                >
                  <Ionicons name="add" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.createButtonText}>Create Split</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Splits list */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingCard}>
                <View style={styles.loadingCardGlass} />
                <Ionicons name="hourglass-outline" size={32} color="#6366f1" />
                <Text style={styles.loadingText}>Loading your splits...</Text>
              </View>
            </View>
          ) : (
            <FlatList 
              data={splits} 
              renderItem={renderSplitItem} 
              keyExtractor={item => item.id} 
              style={styles.splitsList}
              contentContainerStyle={styles.splitsListContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyCardGlass} />
                    <Ionicons name="receipt-outline" size={64} color="rgba(99, 102, 241, 0.3)" />
                    <Text style={styles.emptyTitle}>No splits yet</Text>
                    <Text style={styles.emptyText}>Create your first split to get started!</Text>
                  </View>
                </View>
              }
            />
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  floatingOrb: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.1,
  },
  orb1: {
    width: 200,
    height: 200,
    backgroundColor: '#ffffff',
    top: -50,
    right: -50,
  },
  orb2: {
    width: 150,
    height: 150,
    backgroundColor: '#6366f1',
    bottom: 100,
    left: -75,
  },
  orb3: {
    width: 100,
    height: 100,
    backgroundColor: '#8b5cf6',
    top: height * 0.4,
    right: -20,
  },
  safeArea: {
    flex: 1,
    marginTop: Constants.statusBarHeight,
  },
  header: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    backdropFilter: 'blur(20px)',
  } as any,
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    paddingVertical: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerIcon: {
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  inputCardGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(20px)',
  } as any,
  inputContainer: {
    padding: 24,
  },
  inputCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.1)',
  },
  inputIcon: {
    marginLeft: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  createButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  splitsList: {
    flex: 1,
  },
  splitsListContent: {
    paddingBottom: 20,
  },
  splitItemWrapper: {
    marginBottom: 16,
  },
  splitItem: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  splitGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(20px)',
  } as any,
  splitContent: {
    padding: 20,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  splitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  splitInfo: {
    flex: 1,
  },
  splitName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  splitDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  moreButton: {
    padding: 8,
  },
  splitStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    marginHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    padding: 40,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  loadingCardGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(20px)',
  } as any,
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    padding: 40,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emptyCardGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(20px)',
  } as any,
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
}); 