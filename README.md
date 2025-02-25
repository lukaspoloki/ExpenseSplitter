# Expense Splitter

A React Native mobile application that helps friends and groups easily split expenses and calculate fair settlements.

![Expense Splitter App](https://example.com/app-screenshot.png)

## Features

- **Easy Expense Tracking**: Add people and their contributions to a shared expense
- **Automatic Settlement Calculation**: The app automatically calculates the optimal way to settle debts
- **Multiple Currencies**: Support for USD, EUR, GBP, CAD, CHF, NOK, PLN and more
- **Share Settlements**: Generate and share a visual summary of expenses and settlements
- **Persistent Storage**: All splits are saved locally on your device
- **Intuitive UI**: Clean, modern interface with smooth animations

## How It Works

1. **Create a Split**: Start a new expense split and give it a name
2. **Add Contributors**: Enter each person's name and how much they paid
3. **View Settlements**: The app automatically calculates who owes whom to balance everything fairly
4. **Share Results**: Generate a shareable image with all payment details

## Settlement Algorithm

The app uses an optimized algorithm to minimize the number of transactions needed to settle all debts:

1. Calculate each person's fair share (total amount ÷ number of people)
2. Determine who paid more than their share (creditors) and who paid less (debtors)
3. Match debtors with creditors to create the minimum number of transactions

## Technologies Used

- React Native
- Expo
- TypeScript
- AsyncStorage for local data persistence
- React Navigation
- Expo LinearGradient
- ViewShot for image generation
- Expo Sharing

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/expense-splitter.git
   ```

2. Install dependencies:
   ```
   cd expense-splitter
   npm install
   ```

3. Start the Expo development server:
   ```
   npx expo start
   ```

4. Run on your device or emulator:
   - Scan the QR code with the Expo Go app (Android) or Camera app (iOS)
   - Press 'a' for Android emulator or 'i' for iOS simulator

## Usage Tips

- **Swipe from left edge** to navigate back to the splits list
- **Tap on the currency code** in the header to change currencies
- **Tap the share icon** to generate and share a summary image
- **Long-press on a split** in the list view to delete it

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by the need to easily split expenses among friends during trips and gatherings
- UI design inspired by modern mobile application patterns 