package com.myproject.service;

import com.myproject.model.User;
import com.myproject.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {
    
    @Autowired
    private UserRepository userRepository;

    // Add a new user
    public User addUser(User user) {
        return userRepository.save(user);
    }

    // Get all users
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    // Get a user by ID
    public Optional<User> getUserById(String id) {
        return userRepository.findById(id);
    }

    // Get a user by email (using custom query from repository)
    public Optional<User> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    // Update user details
    public User updateUser(String id, User updatedUser) {
        if (userRepository.existsById(id)) {
            updatedUser.setId(id);  // Ensure the ID remains the same
            return userRepository.save(updatedUser);
        }
        return null;  // User not found
    }

    // Delete a user by ID
    public void deleteUser(String id) {
        userRepository.deleteById(id);
    }
}
