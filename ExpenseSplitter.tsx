import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  PanResponder,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProps, RouteProps, Split, Person, Settlement } from './App';
import ViewShot from "react-native-view-shot";
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

interface ExpenseSplitterProps {
  route: RouteProps;
  navigation: NavigationProps;
}

export default function ExpenseSplitter({ route, navigation }: ExpenseSplitterProps) {
  const { splitId } = route.params || {};
  const [people, setPeople] = useState<Person[]>([]);
  const [newName, setNewName] = useState<string>('');
  const [newAmount, setNewAmount] = useState<string>('');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [splitName, setSplitName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currency, setCurrency] = useState<string>('USD');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));
  const [formFocused, setFormFocused] = useState<boolean>(false);
  
  const currencySymbols: {[key: string]: string} = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'C$',
    CHF: 'CHF',
    NOK: 'NOK',
    PLN: 'PLN',
  };
  
  const nameInputRef = useRef<TextInput>(null);
  const amountInputRef = useRef<TextInput>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const viewShotRef = useRef<ViewShot>(null);

  // Function to handle navigation back
  const goBackToSplitList = () => {
    navigation.goBack();
  };

  // Set up pan responder for swipe back
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal gestures starting from the left edge
        return gestureState.dx > 20 && gestureState.moveX < 50;
      },
      onPanResponderGrant: () => {
        // Fix for TypeScript error about _value property
        const valueX = pan.x as any;
        const valueY = pan.y as any;
        
        pan.setOffset({
          x: valueX._value,
          y: valueY._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow swiping to the right (positive dx)
        if (gestureState.dx > 0) {
          pan.x.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If swiped far enough to the right, navigate back
        if (gestureState.dx > width * 0.3) {
          Animated.timing(pan.x, {
            toValue: width,
            duration: 250,
            useNativeDriver: false
          }).start(goBackToSplitList);
        } else {
          // Otherwise, reset position
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            tension: 40,
            useNativeDriver: false
          }).start();
        }
      }
    })
  ).current;

  // Load split data when component mounts or splitId changes
  useEffect(() => {
    if (splitId) {
      loadSplitData();
    } else {
      setIsLoading(false);
    }
    
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
  }, [splitId]);

  // Save split data when people, settlements, or splitName changes
  useEffect(() => {
    if (splitId && !isLoading) {
      saveSplitData();
    }
  }, [people, settlements, splitName, currency]);

  const loadSplitData = async () => {
    try {
      setIsLoading(true);
      const savedSplits = await AsyncStorage.getItem('splits');
      
      if (savedSplits) {
        const splits: Split[] = JSON.parse(savedSplits);
        const currentSplit = splits.find(split => split.id === splitId);
        
        if (currentSplit) {
          setPeople(currentSplit.people || []);
          setSettlements(currentSplit.settlements || []);
          setSplitName(currentSplit.name || '');
          setCurrency(currentSplit.currency || 'USD');
        }
      }
    } catch (error) {
      console.error('Failed to load split data:', error);
      Alert.alert('Error', 'Failed to load split data');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSplitData = async () => {
    try {
      if (!splitId) return;
      
      const savedSplits = await AsyncStorage.getItem('splits');
      let splits: Split[] = savedSplits ? JSON.parse(savedSplits) : [];
      
      const splitIndex = splits.findIndex(split => split.id === splitId);
      
      if (splitIndex !== -1) {
        splits[splitIndex] = {
          ...splits[splitIndex],
          name: splitName.trim() || 'Untitled Split',
          people: people,
          settlements: settlements,
          currency: currency
        };
        
        await AsyncStorage.setItem('splits', JSON.stringify(splits));
      }
    } catch (error) {
      console.error('Failed to save split data:', error);
      Alert.alert('Error', 'Failed to save split data');
    }
  };

  const addPerson = () => {
    setErrorMessage('');
    
    if (!newName.trim()) {
      setErrorMessage('Name is required');
      return;
    }

    if (!newAmount) {
      setErrorMessage('Amount is required');
      return;
    }
    
    // Check for duplicate names (case insensitive)
    if (people.some(person => person.name.toLowerCase() === newName.trim().toLowerCase())) {
      setErrorMessage('A person with this name already exists');
      return;
    }
    
    const newPerson: Person = {
      name: newName.trim(),
      amount: parseFloat(newAmount)
    };
    
    const updatedPeople = [...people, newPerson];
    setPeople(updatedPeople);
    calculateSettlements(updatedPeople);
    
    // Reset form
    setNewName('');
    setNewAmount('');
    nameInputRef.current?.focus();
  };

  const removePerson = (index: number) => {
    Alert.alert(
      "Remove Person", 
      "Are you sure you want to remove this person?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => {
          const updatedPeople = people.filter((_, i) => i !== index);
          setPeople(updatedPeople);
          calculateSettlements(updatedPeople);
        }}
      ]
    );
  };

  const calculateSettlements = (peopleList = people) => {
    if (peopleList.length < 2) {
      setSettlements([]);
      return;
    }

    const totalAmount = peopleList.reduce((sum, person) => sum + person.amount, 0);
    const averageAmount = totalAmount / peopleList.length;

    // Calculate who owes what
    const balances = peopleList.map(person => ({
      name: person.name,
      balance: person.amount - averageAmount
    }));

    const settlements: Settlement[] = [];
    const debtors = balances.filter(b => b.balance < 0).map(b => ({ ...b, balance: -b.balance }));
    const creditors = balances.filter(b => b.balance > 0);

    // Simple settlement algorithm
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debt = debtors[i].balance;
      const credit = creditors[j].balance;
      const settlement = Math.min(debt, credit);

      if (settlement > 0.01) { // Avoid tiny settlements
        settlements.push({
          from: debtors[i].name,
          to: creditors[j].name,
          amount: settlement
        });
      }

      debtors[i].balance -= settlement;
      creditors[j].balance -= settlement;

      if (debtors[i].balance < 0.01) i++;
      if (creditors[j].balance < 0.01) j++;
    }

    setSettlements(settlements);
  };

  const handleAmountChange = (text: string) => {
    // Allow only numbers and one decimal point
    const filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    if (parts.length > 2) return;
    setNewAmount(filtered);
  };

  const handleSplitNameChange = (text: string) => {
    setSplitName(text);
  };

  const handleCurrencyChange = async (selectedCurrency: string) => {
    setCurrency(selectedCurrency);
    
    // Show confirmation
    Alert.alert(
      "Currency Changed", 
      `Currency changed to ${selectedCurrency}`,
      [{ text: "OK" }]
    );
  };

  const getCurrencySymbol = () => {
    return currencySymbols[currency] || currency;
  };

  const formatCurrency = (amount: number) => {
    const symbol = getCurrencySymbol();
    return `${symbol}${amount.toFixed(2)}`;
  };

  const shareSettlementImage = async () => {
    try {
      if (!viewShotRef.current?.capture) return;
      
      const uri = await viewShotRef.current.capture();
      const fileUri = FileSystem.documentDirectory + 'settlement.png';
      await FileSystem.moveAsync({
        from: uri,
        to: fileUri,
      });
      
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error('Failed to share image:', error);
      Alert.alert('Error', 'Failed to share settlement image');
    }
  };

  const getTotalAmount = () => {
    return people.reduce((sum, person) => sum + person.amount, 0);
  };

  const getAverageAmount = () => {
    return people.length > 0 ? getTotalAmount() / people.length : 0;
  };

  const SplitSummaryCard = () => (
    <ViewShot ref={viewShotRef} style={styles.summaryCardForSharing}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={[0, 0]}
        end={[1, 0]}
        style={styles.summaryCardHeader}
      >
        <Text style={styles.summaryCardTitle}>{splitName}</Text>
        <Text style={styles.summaryCardSubtitle}>Expense Split Summary</Text>
      </LinearGradient>
      
      <View style={styles.summaryCardContent}>
        <View style={styles.summaryCardSection}>
          <Text style={styles.summaryCardSectionTitle}>Total Amount</Text>
          <Text style={styles.summaryCardAmount}>
            {formatCurrency(getTotalAmount())}
          </Text>
        </View>
        
        <View style={styles.summaryCardSection}>
          <Text style={styles.summaryCardSectionTitle}>Fair Share Per Person</Text>
          <Text style={styles.summaryCardAmount}>
            {formatCurrency(getAverageAmount())}
          </Text>
        </View>
        
        {/* Add payment overview section */}
        <View style={styles.summaryCardDivider} />
        <Text style={styles.summaryCardSectionTitle}>Payments Made</Text>
        
        {people.map((person, index) => (
          <View key={index} style={styles.summaryCardPaymentRow}>
            <Text style={styles.summaryCardPaymentName}>{person.name}</Text>
            <Text style={styles.summaryCardPaymentAmount}>{formatCurrency(person.amount)}</Text>
          </View>
        ))}
        
        <View style={styles.summaryCardDivider} />
        
        <Text style={styles.summaryCardSectionTitle}>Settlements</Text>
        <Text style={styles.summaryCardInstructions}>
          To settle all debts, the following payments should be made:
        </Text>
        
        {settlements.map((item, index) => (
          <View key={index} style={styles.summaryCardTransferRow}>
            <View style={styles.summaryCardPayerBadge}>
              <Text style={styles.summaryCardPayerText}>{item.from}</Text>
            </View>
            <Text style={styles.summaryCardArrowText}>→</Text>
            <View style={styles.summaryCardReceiverBadge}>
              <Text style={styles.summaryCardReceiverText}>{item.to}</Text>
            </View>
            <View style={styles.summaryCardTransferAmount}>
              <Text style={styles.summaryCardTransferAmountText}>{formatCurrency(item.amount)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ViewShot>
  );

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateX: pan.x }] }
      ]}
      {...panResponder.panHandlers}
    >
      <StatusBar style="light" backgroundColor="transparent" translucent />
      
      {/* Background gradient */}
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        start={[0, 0]}
        end={[1, 1]}
        style={styles.backgroundGradient}
      />
      
      {/* Floating orbs */}
      <View style={[styles.floatingOrb, styles.orb1]} />
      <View style={[styles.floatingOrb, styles.orb2]} />
      <View style={[styles.floatingOrb, styles.orb3]} />
      
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoid}
        >
          <View style={styles.mainContainer}>
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
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={goBackToSplitList}
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
                
                <View style={styles.headerCenter}>
                  <TextInput
                    style={styles.splitNameInput}
                    value={splitName}
                    onChangeText={handleSplitNameChange}
                    placeholder="Split Name"
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    onBlur={() => {
                      if (!splitName.trim()) {
                        setSplitName('Untitled Split');
                      }
                      saveSplitData();
                    }}
                  />
                  <Text style={styles.headerSubtitle}>
                    {people.length} {people.length === 1 ? 'person' : 'people'} • {formatCurrency(getTotalAmount())}
                  </Text>
                </View>

                <View style={styles.headerActions}>
                  <TouchableOpacity 
                    style={styles.currencyButton}
                    onPress={() => {
                      Alert.alert(
                        "Select Currency",
                        "Choose the currency for this split",
                        Object.keys(currencySymbols).map(curr => ({
                          text: `${curr} (${currencySymbols[curr]})`,
                          onPress: () => handleCurrencyChange(curr)
                        }))
                      );
                    }}
                  >
                    <Text style={styles.currencyButtonText}>{currency}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.shareButton, people.length < 2 && styles.shareButtonDisabled]}
                    onPress={shareSettlementImage}
                    disabled={people.length < 2}
                  >
                    <Ionicons name="share-outline" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
            
            <ScrollView 
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <View style={styles.loadingCard}>
                    <View style={styles.loadingCardGlass} />
                    <Ionicons name="hourglass-outline" size={32} color="#6366f1" />
                    <Text style={styles.loadingText}>Loading split data...</Text>
                  </View>
                </View>
              ) : (
                <Animated.View
                  style={{
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }}
                >
                  {/* Add Person Form */}
                  <View style={styles.formCard}>
                    <View style={styles.formCardGlass} />
                    <View style={styles.formContainer}>
                      <View style={styles.formHeader}>
                        <Ionicons name="person-add-outline" size={24} color="#6366f1" />
                        <Text style={styles.sectionTitle}>Add Person</Text>
                      </View>
                      
                      {errorMessage ? (
                        <View style={styles.errorContainer}>
                          <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                          <Text style={styles.errorText}>{errorMessage}</Text>
                        </View>
                      ) : null}
                      
                      <View style={styles.inputRow}>
                        <View style={styles.inputWrapper}>
                          <Ionicons name="person-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                          <TextInput
                            ref={nameInputRef}
                            style={styles.input}
                            placeholder="Name"
                            placeholderTextColor="rgba(107, 114, 128, 0.6)"
                            value={newName}
                            onChangeText={setNewName}
                            onSubmitEditing={() => amountInputRef.current?.focus()}
                            returnKeyType="next"
                            onFocus={() => setFormFocused(true)}
                            onBlur={() => setFormFocused(false)}
                          />
                        </View>
                        
                        <View style={styles.inputWrapper}>
                          <Text style={styles.currencyPrefix}>{getCurrencySymbol()}</Text>
                          <TextInput
                            ref={amountInputRef}
                            style={[styles.input, styles.amountInput]}
                            placeholder="0.00"
                            placeholderTextColor="rgba(107, 114, 128, 0.6)"
                            value={newAmount}
                            onChangeText={handleAmountChange}
                            keyboardType="numeric"
                            onSubmitEditing={addPerson}
                            returnKeyType="done"
                            onFocus={() => setFormFocused(true)}
                            onBlur={() => setFormFocused(false)}
                          />
                        </View>
                      </View>
                      
                      <TouchableOpacity 
                        style={[styles.addPersonButton, (!newName.trim() || !newAmount) && styles.addPersonButtonDisabled]} 
                        onPress={addPerson}
                        disabled={!newName.trim() || !newAmount}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={(!newName.trim() || !newAmount) ? ['#d1d5db', '#9ca3af'] : ['#6366f1', '#8b5cf6']}
                          start={[0, 0]}
                          end={[1, 0]}
                          style={styles.addPersonButtonGradient}
                        >
                          <Ionicons name="add" size={20} color="white" style={{ marginRight: 8 }} />
                          <Text style={styles.addPersonButtonText}>Add Person</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* People List */}
                  {people.length > 0 && (
                    <View style={styles.peopleCard}>
                      <View style={styles.peopleCardGlass} />
                      <View style={styles.peopleContainer}>
                        <View style={styles.peopleHeader}>
                          <Ionicons name="people-outline" size={24} color="#6366f1" />
                          <Text style={styles.sectionTitle}>People ({people.length})</Text>
                          <View style={styles.totalBadge}>
                            <Text style={styles.totalBadgeText}>{formatCurrency(getTotalAmount())}</Text>
                          </View>
                        </View>
                        
                        {people.map((person, index) => (
                          <View key={index} style={styles.personItem}>
                            <View style={styles.personIcon}>
                              <Ionicons name="person" size={20} color="#6366f1" />
                            </View>
                            <View style={styles.personInfo}>
                              <Text style={styles.personName}>{person.name}</Text>
                              <Text style={styles.personAmount}>{formatCurrency(person.amount)}</Text>
                            </View>
                            <View style={styles.personBalance}>
                              <Text style={[
                                styles.personBalanceText,
                                person.amount > getAverageAmount() ? styles.personBalancePositive : styles.personBalanceNegative
                              ]}>
                                {person.amount > getAverageAmount() ? '+' : ''}{formatCurrency(person.amount - getAverageAmount())}
                              </Text>
                            </View>
                            <TouchableOpacity 
                              style={styles.removeButton}
                              onPress={() => removePerson(index)}
                            >
                              <Ionicons name="close-circle" size={24} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {/* Settlements */}
                  {settlements.length > 0 && (
                    <View style={styles.settlementsCard}>
                      <View style={styles.settlementsCardGlass} />
                      <View style={styles.settlementsContainer}>
                        <View style={styles.settlementsHeader}>
                          <Ionicons name="swap-horizontal-outline" size={24} color="#6366f1" />
                          <Text style={styles.sectionTitle}>Settlements</Text>
                        </View>
                        <Text style={styles.settlementInstructions}>
                          To settle all debts fairly, these payments should be made:
                        </Text>
                        
                        {settlements.map((settlement, index) => (
                          <View key={index} style={styles.settlementItem}>
                            <View style={styles.settlementFlow}>
                              <View style={styles.payerBadge}>
                                <Ionicons name="person" size={16} color="#dc2626" />
                                <Text style={styles.payerText}>{settlement.from}</Text>
                              </View>
                              
                              <View style={styles.arrowContainer}>
                                <Ionicons name="arrow-forward" size={20} color="#6366f1" />
                              </View>
                              
                              <View style={styles.receiverBadge}>
                                <Ionicons name="person" size={16} color="#059669" />
                                <Text style={styles.receiverText}>{settlement.to}</Text>
                              </View>
                            </View>
                            
                            <View style={styles.transferAmount}>
                              <Text style={styles.transferAmountText}>{formatCurrency(settlement.amount)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {/* Summary Stats */}
                  {people.length > 0 && (
                    <View style={styles.summaryCard}>
                      <View style={styles.summaryCardGlass} />
                      <View style={styles.summaryContainer}>
                        <Text style={styles.summaryTitle}>Split Summary</Text>
                        
                        <View style={styles.summaryStats}>
                          <View style={styles.summaryStatItem}>
                            <Text style={styles.summaryStatValue}>{people.length}</Text>
                            <Text style={styles.summaryStatLabel}>People</Text>
                          </View>
                          <View style={styles.summaryStatDivider} />
                          <View style={styles.summaryStatItem}>
                            <Text style={styles.summaryStatValue}>{formatCurrency(getTotalAmount())}</Text>
                            <Text style={styles.summaryStatLabel}>Total</Text>
                          </View>
                          <View style={styles.summaryStatDivider} />
                          <View style={styles.summaryStatItem}>
                            <Text style={styles.summaryStatValue}>{formatCurrency(getAverageAmount())}</Text>
                            <Text style={styles.summaryStatLabel}>Per Person</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                  
                  {/* Hidden ViewShot for sharing */}
                  <View style={{ position: 'absolute', left: -9999 }}>
                    <SplitSummaryCard />
                  </View>
                </Animated.View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}

// Your existing styles...
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
  statusBarBackground: {
    height: Constants.statusBarHeight,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  safeArea: {
    flex: 1,
    marginTop: Constants.statusBarHeight,
  },
  keyboardAvoid: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  headerTitleContainer: {
    width: '100%',
    },
  content: {
    flex: 1,
    padding: 16,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  formContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  addPersonButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  addPersonButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  settlementsContainer: {
    marginBottom: 24,
  },
  settlementsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  settlementItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  settlementText: {
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,   
    color: '#6b7280',
  },
  settlementsList: {
    flex: 1,
  },
  splitNameInput: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
    padding: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 8,
  },
  peopleContainer: {
    marginBottom: 24,
  },
  personItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  personName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  personAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 12,
  },
  removeButton: {
    padding: 4,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  payerBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  payerText: {
    color: '#b91c1c',
    fontWeight: '500',
  },
  arrowText: {
    marginHorizontal: 8,
    color: '#9ca3af',
    fontSize: 18,
  },
  receiverBadge: {
    backgroundColor: '#d1fae5',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  receiverText: {
    color: '#065f46',
    fontWeight: '500',
  },
  transferAmount: {
    marginLeft: 'auto',
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  transferAmountText: {
    color: 'white',
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#4b5563',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: 'bold',
  },
  settlementInstructions: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  currencyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  currencyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  summaryCardForSharing: {
    width: width * 0.8,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryCardHeader: {
    padding: 16,
  },
  summaryCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  summaryCardSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  summaryCardContent: {
    padding: 16,
  },
  summaryCardSection: {
    marginBottom: 16,
  },
  summaryCardSectionTitle: {
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryCardAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  summaryCardDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  summaryCardInstructions: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  summaryCardTransferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryCardPayerBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  summaryCardPayerText: {
    color: '#b91c1c',
    fontWeight: '500',
    fontSize: 14,
  },
  summaryCardArrowText: {
    marginHorizontal: 8,
    color: '#9ca3af',
    fontSize: 16,
  },
  summaryCardReceiverBadge: {
    backgroundColor: '#d1fae5',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  summaryCardReceiverText: {
    color: '#065f46',
    fontWeight: '500',
    fontSize: 14,
  },
  summaryCardTransferAmount: {
    marginLeft: 'auto',
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  summaryCardTransferAmountText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
  },
  shareButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCardPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryCardPaymentName: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  summaryCardPaymentAmount: {
    fontSize: 14,
    color: '#111827',
    fontWeight: 'bold',
  },
  headerGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  loadingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCardGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  formCardGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  inputIcon: {
    marginRight: 8,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  amountInput: {
    width: 100,
  },
  addPersonButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  peopleCardGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  peopleContainer: {
    marginBottom: 24,
  },
  peopleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  totalBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#b91c1c',
  },
  personIcon: {
    marginRight: 12,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '500',
  },
  personAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  personBalance: {
    marginLeft: 'auto',
  },
  personBalanceText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  personBalancePositive: {
    color: '#059669',
  },
  personBalanceNegative: {
    color: '#dc2626',
  },
  settlementsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  settlementsCardGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  settlementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  settlementInstructions: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  summaryCardGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStatItem: {
    flex: 1,
  },
  summaryStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  summaryStatLabel: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  summaryStatDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  addPersonButtonDisabled: {
    opacity: 0.6,
  },
  settlementFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  arrowContainer: {
    marginHorizontal: 12,
  },
}); 