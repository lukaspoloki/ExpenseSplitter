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

const { width } = Dimensions.get('window');

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
    
    // Clear inputs after adding a person
    setNewName('');
    setNewAmount('');
    
    // Focus back on the name input for quick entry of next person
    nameInputRef.current?.focus();
    
    // Recalculate settlements when a person is added
    if (updatedPeople.length >= 2) {
      calculateSettlements(updatedPeople);
    }
  };

  const removePerson = (index: number) => {
    const updatedPeople = people.filter((_, i) => i !== index);
    setPeople(updatedPeople);
    
    // Recalculate settlements or clear them if fewer than 2 people
    if (updatedPeople.length >= 2) {
      calculateSettlements(updatedPeople);
    } else {
      setSettlements([]);
    }
  };

  const calculateSettlements = (peopleList = people) => {
    if (peopleList.length < 2) {
      Alert.alert("Error", "You need at least 2 people to calculate settlements");
      return [];
    }

    const totalAmount = peopleList.reduce((sum, person) => sum + person.amount, 0);
    const averageAmount = totalAmount / peopleList.length;
    
    // Create two arrays: one for people who paid more (creditors)
    // and one for people who paid less (debtors)
    const creditors: {name: string, amount: number}[] = [];
    const debtors: {name: string, amount: number}[] = [];
    
    peopleList.forEach(person => {
      const diff = person.amount - averageAmount;
      if (diff > 0.01) { // Using small threshold to avoid floating point issues
        creditors.push({name: person.name, amount: diff});
      } else if (diff < -0.01) {
        debtors.push({name: person.name, amount: -diff}); // Convert to positive
      }
    });
    
    // Sort both arrays by amount (descending)
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);
    
    const newSettlements: Settlement[] = [];
    
    // For each debtor, find creditors to pay
    debtors.forEach(debtor => {
      let remainingDebt = debtor.amount;
      
      while (remainingDebt > 0.01 && creditors.length > 0) { // Using 0.01 to avoid floating point issues
        const creditor = creditors[0];
        const paymentAmount = Math.min(remainingDebt, creditor.amount);
        
        if (paymentAmount > 0) {
          newSettlements.push({
            from: debtor.name,
            to: creditor.name,
            amount: Math.round(paymentAmount * 100) / 100 // Round to 2 decimal places
          });
        }
        
        remainingDebt -= paymentAmount;
        creditor.amount -= paymentAmount;
        
        // If creditor is fully paid, remove them from the list
        if (creditor.amount < 0.01) {
          creditors.shift();
        }
      }
    });
    
    setSettlements(newSettlements);
    return newSettlements;
  };
  
  const handleAmountChange = (text: string) => {
    const numericValue = parseFloat(text);
    if (!isNaN(numericValue) || text === '' || text === '.') {
      setNewAmount(text);
    }
  };

  const renderSettlement = ({ item }: { item: Settlement }) => (
    <View style={styles.settlementItem}>
      <Text style={styles.settlementText}>
        {item.from} owes {item.to} {item.amount}
      </Text>
    </View>
  );

  // Add a function to handle split name changes
  const handleSplitNameChange = (text: string) => {
    setSplitName(text);
    // No need for debounce as the useEffect will save when splitName changes
  };

  // Update the handleCurrencyChange function to save data immediately and reliably
  const handleCurrencyChange = async (selectedCurrency: string) => {
    // First update the state
    setCurrency(selectedCurrency);
    
    // Then manually save the data with the new currency
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
          currency: selectedCurrency // Use the new currency directly
        };
        
        await AsyncStorage.setItem('splits', JSON.stringify(splits));
        console.log('Currency updated and saved:', selectedCurrency);
      }
    } catch (error) {
      console.error('Failed to save currency change:', error);
      Alert.alert('Error', 'Failed to save currency change');
    }
  };

  // Add the currency symbol getter
  const getCurrencySymbol = () => {
    return currencySymbols[currency] || '$';
  };

  // Add this function to format currency display with proper spacing
  const formatCurrency = (amount: number) => {
    const symbol = currencySymbols[currency] || currency;
    
    // For currency codes (not symbols), add a space between code and amount
    const needsSpace = symbol.length > 1;
    
    return needsSpace 
      ? `${symbol} ${amount.toFixed(2)}`
      : `${symbol}${amount.toFixed(2)}`;
  };

  // Add this function to handle sharing
  const shareSettlementImage = async () => {
    if (!viewShotRef.current || people.length < 2) return;
    
    try {
      const uri = await viewShotRef.current?.capture?.() || '';
    
      if (!uri) {
        Alert.alert('Error', 'Failed to capture image');
        return;
      }
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      
      // Save the image to a temporary file if needed
      const tempUri = FileSystem.cacheDirectory + `${splitName}-summary.png`;
      await FileSystem.copyAsync({
        from: uri,
        to: tempUri
      });
      
      // Share the image
      await Sharing.shareAsync(tempUri, {
        mimeType: 'image/png',
        dialogTitle: `${splitName} - Split Summary`,
      });
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('Error', 'Failed to share the split summary');
    }
  };

  // Update the SplitSummaryCard component to include payment overview
  const SplitSummaryCard = () => (
    <View style={styles.summaryCardForSharing}>
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
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
            {formatCurrency(people.reduce((sum, person) => sum + person.amount, 0))}
          </Text>
        </View>
        
        <View style={styles.summaryCardSection}>
          <Text style={styles.summaryCardSectionTitle}>Fair Share Per Person</Text>
          <Text style={styles.summaryCardAmount}>
            {formatCurrency(people.reduce((sum, person) => sum + person.amount, 0) / people.length)}
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
    </View>
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
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        start={[0, 0]}
        end={[1, 0]}
        style={styles.statusBarBackground}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoid}
        >
          <View style={styles.mainContainer}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={[0, 0]}
              end={[1, 0]}
              style={styles.header}
            >
              <View style={styles.headerContent}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={goBackToSplitList}
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
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
                  style={styles.shareButton}
                  onPress={shareSettlementImage}
                  disabled={people.length < 2}
                >
                  <Ionicons name="share-outline" size={20} color="white" />
                </TouchableOpacity>
              </View>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Expense Splitter</Text>
                <Text style={styles.headerSubtitle}>Track expenses and balance payments fairly</Text>
              </View>
            </LinearGradient>
            
            <ScrollView 
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={true}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading split data...</Text>
                </View>
              ) : (
                <>
                  {/* Add Person Form */}
                  <View style={styles.formContainer}>
                    <Text style={styles.sectionTitle}>Add Person</Text>
                    
                    {errorMessage ? (
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    ) : null}
                    
                    <TextInput
                      ref={nameInputRef}
                      style={styles.input}
                      placeholder="Name"
                      value={newName}
                      onChangeText={setNewName}
                      onSubmitEditing={() => amountInputRef.current?.focus()}
                      returnKeyType="next"
                    />
                    
                    <TextInput
                      ref={amountInputRef}
                      style={styles.input}
                      placeholder="Amount paid"
                      value={newAmount}
                      onChangeText={handleAmountChange}
                      keyboardType="numeric"
                      onSubmitEditing={addPerson}
                    />
                    
                    <TouchableOpacity style={styles.addPersonButton} onPress={addPerson}>
                      <Text style={styles.addPersonButtonText}>Add Person</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* People List */}
                  {people.length > 0 && (
                    <View style={styles.peopleContainer}>
                      <Text style={styles.sectionTitle}>People</Text>
                      <FlatList
                        data={people}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item, index }) => (
                          <View style={styles.personItem}>
                            <Text style={styles.personName}>{item.name}</Text>
                            <Text style={styles.personAmount}>{formatCurrency(item.amount)}</Text>
                            <TouchableOpacity 
                              style={styles.removeButton}
                              onPress={() => removePerson(index)}
                            >
                              <Ionicons name="close-circle" size={24} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                        nestedScrollEnabled={true}
                        scrollEnabled={false}
                      />
                    </View>
                  )}
                  
                  {/* Settlements List - now automatically calculated */}
                  {settlements.length > 0 && (
                    <View style={styles.settlementsContainer}>
                      <Text style={styles.sectionTitle}>Settlements</Text>
                      
                      {/* Add summary information */}
                      <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Total Expenses:</Text>
                          <Text style={styles.summaryValue}>
                            {formatCurrency(people.reduce((sum, person) => sum + person.amount, 0))}
                          </Text>
                        </View>
                        
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Fair Share Per Person:</Text>
                          <Text style={styles.summaryValue}>
                            {formatCurrency(people.reduce((sum, person) => sum + person.amount, 0) / people.length)}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={styles.settlementInstructions}>
                        To settle all debts, the following payments should be made:
                      </Text>
                      
                      <FlatList
                        data={settlements}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item }) => (
                          <View style={styles.transferRow}>
                            <View style={styles.payerBadge}>
                              <Text style={styles.payerText}>{item.from}</Text>
                            </View>
                            <Text style={styles.arrowText}>→</Text>
                            <View style={styles.receiverBadge}>
                              <Text style={styles.receiverText}>{item.to}</Text>
                            </View>
                            <View style={styles.transferAmount}>
                              <Text style={styles.transferAmountText}>{formatCurrency(item.amount)}</Text>
                            </View>
                          </View>
                        )}
                        nestedScrollEnabled={true}
                        scrollEnabled={false}
                      />
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <View style={{ position: 'absolute', opacity: 0, width: width * 0.8 }}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
          <SplitSummaryCard />
        </ViewShot>
      </View>
    </Animated.View>
  );
}

// Your existing styles...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
}); 