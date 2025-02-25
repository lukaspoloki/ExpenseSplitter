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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProps, Split } from './App';

interface SplitListProps {
  navigation: NavigationProps;
  refreshTrigger?: number;
}

export default function SplitList({ navigation, refreshTrigger = 0 }: SplitListProps) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [newSplitName, setNewSplitName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadSplits();
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

  const renderSplitItem = ({ item }: { item: Split }) => (
    <TouchableOpacity 
      style={styles.splitItem}
      onPress={() => openSplit(item)}
      onLongPress={() => deleteSplit(item.id)}
    >
        <View style={styles.splitContent}>
            <Text style={styles.splitName}>{item.name}</Text>
            <Text style={styles.splitDate}>
                {new Date(item.createdAt).toLocaleDateString()}
            </Text>
        </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        start={[0, 0]}
        end={[1, 0]}
        style={styles.statusBarBackground}
      />
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          start={[0, 0]}
          end={[1, 0]}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Split Expenses</Text>
          <Text style={styles.headerSubtitle}>Create and manage your expense splits</Text>
        </LinearGradient>
        
        <View style={styles.content}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter split name..."
              value={newSplitName}
              onChangeText={setNewSplitName}
            />
            <TouchableOpacity 
              style={styles.createButton}
              onPress={createNewSplit}
            >
              <Text style={styles.createButtonText}>Create Split</Text>
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading splits...</Text>
            </View>
          ) : (
            <FlatList 
              data={splits} 
              renderItem={renderSplitItem} 
              keyExtractor={item => item.id} 
              style={styles.splitsList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No splits yet. Create one to get started!</Text>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  header: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 16,
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
  content: {
    padding: 16,
    flex: 1,
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
  splitItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  splitContent: {
    padding: 16,
  },
  splitName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  splitDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  splitsList: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden', 
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  createButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 12,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
}); 