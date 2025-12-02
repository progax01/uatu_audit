#!/bin/bash
# Simple notification beep for task completion

# Try multiple methods to ensure beep works
echo -e "\a"  # System bell
sleep 0.1
echo -e "\a"  # Second beep for emphasis
sleep 0.1
echo -e "\a"  # Third beep

# Print completion message
echo "🔔 Task Complete!"
