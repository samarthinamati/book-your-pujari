          </Text>

          <View
            style={styles.poojaCard}
          >
            <Text
              style={styles.poojaName}
            >
              {selectedPooja.name ||
                'Pooja Service'}
            </Text>

            {selectedPooja.description ? (
              <Text
                style={
                  styles.poojaDescription
                }
              >
                {
                  selectedPooja.description
                }
              </Text>
            ) : null}

            {selectedPooja.duration ? (
              <View
                style={styles.poojaMeta}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color="#666"
                />

                <Text
                  style={styles.metaText}
                >
                  {
                    selectedPooja.duration
                  }
                </Text>
              </View>
            ) : null}

            <View
              style={styles.priceRow}
            >
              <Text
                style={styles.priceLabel}
              >
                Pooja Price
              </Text>

              <Text
                style={styles.priceValue}
              >
                ₹{pricing.base}
              </Text>
            </View>
          </View>
        </View>

        {/* SAINT VISIT DATE & TIME */}

        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            When should the Saint visit?
          </Text>

          <Text
            style={styles.sectionDescription}
          >
            Select when the Saint should come to
            your home for the pooja.
          </Text>

          {/* VISIT DATE */}

          <TouchableOpacity
            style={
              styles.dateTimeButton
            }
            onPress={() => {
  if (Platform.OS === 'web') {
    openWebPicker('date');
  } else {
    setShowDatePicker(true);
  }
}}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={22}
              color="#FF6B35"
            />

            <View
              style={styles.dateTimeInfo}
            >
              <Text
                style={
                  styles.dateTimeLabel
                }
              >
                Visit Date
              </Text>

              <Text
                style={
                  styles.dateTimeText
                }
              >
                {visitDate.toLocaleDateString(
                  'en-IN',
                  {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }
                )}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#999"
            />
          </TouchableOpacity>

          {/* VISIT TIME */}

          <TouchableOpacity
            style={
              styles.dateTimeButton
            }
            onPress={() => {
  if (Platform.OS === 'web') {
    openWebPicker('time');
  } else {
    setShowTimePicker(true);
  }
}}
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="time-outline"
              size={22}
              color="#FF6B35"
            />

            <View
              style={styles.dateTimeInfo}
            >
              <Text
                style={
                  styles.dateTimeLabel
                }
              >
                Visit Time
              </Text>

              <Text
                style={
                  styles.dateTimeText
                }
              >
                {visitTime.toLocaleTimeString(
                  'en-IN',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#999"
            />
          </TouchableOpacity>

          
{/* DATE PICKER */}
{showDatePicker &&
  (Platform.OS === 'web' ? (
    <WebDateTimeInput
      mode="date"
      value={visitDate}
      onChange={(date) => {
        setVisitDate(date);
        setShowDatePicker(false);
      }}
    />
  ) : (
    <DateTimePicker
      value={visitDate}
      mode="date"
      minimumDate={new Date()}
      display="default"
      onChange={(event, date) => {
        setShowDatePicker(false);
        if (date) {
          setVisitDate(date);
        }
      }}
    />
  ))}

{/* TIME PICKER */}
{showTimePicker &&
  (Platform.OS === 'web' ? (
    <WebDateTimeInput
      mode="time"
      value={visitTime}
      onChange={(time) => {
        setVisitTime(time);
        setShowTimePicker(false);
      }}
    />
  ) : (
    <DateTimePicker
      value={visitTime}
      mode="time"
      display="default"
      onChange={(event, date) => {
        setShowTimePicker(false);
        if (date) {
          setVisitTime(date);
        }
      }}
    />
  ))}
        </View>

        {/* CUSTOMER DETAILS */}

        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            Your Details
          </Text>

          <View
            style={styles.inputContainer}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color="#666"
            />

            <TextInput
              style={styles.input}
              placeholder="Your Name"
              value={customerName}
              onChangeText={
                setCustomerName
              }
              placeholderTextColor="#999"
            />
          </View>

          <View
            style={styles.inputContainer}
          >
            <Ionicons
              name="call-outline"
              size={20}
              color="#666"
            />

            <TextInput
              style={styles.input}
              placeholder="Your Phone Number"
              value={customerPhone}
              onChangeText={
                setCustomerPhone
              }
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />
          </View>

          <View
            style={styles.inputContainer}
          >
            <Ionicons
              name="location-outline"
              size={20}
              color="#666"
            />

            <TextInput
              style={[
                styles.input,
                styles.textArea,
              ]}
              placeholder="Your Home Address"
              value={address}
              onChangeText={
                setAddress
              }
              multiline
              numberOfLines={3}
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* TOTAL */}

        <View
          style={styles.totalSection}
        >
          <View
            style={styles.totalCard}
          >
            <Text
              style={
                styles.totalCardLabel
              }
            >
              Total Amount
            </Text>

            <Text
              style={
                styles.totalCardValue
              }
            >
              ₹{pricing.total}
            </Text>

            <Text
              style={
                styles.commissionText
              }
            >
              Includes 10% platform commission
            </Text>
          </View>
        </View>

        {/* PAYMENT */}

        <TouchableOpacity
          style={[
            styles.bookButton,
            submitting &&
              styles.buttonDisabled,
          ]}
          onPress={handleBooking}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator
              color="#FFF"
            />
          ) : (
            <>
              <Text
                style={
                  styles.bookButtonText
                }
              >
                Proceed to Payment
              </Text>

              <Ionicons
                name="arrow-forward"
                size={20}
                color="#FFF"
              />
            </>
          )}
        </TouchableOpacity>

        {/* CHECK BOOKINGS & STATUS */}

        <TouchableOpacity
          style={
            styles.checkBookingsButton
          }
          onPress={() =>
            router.push(
              '/customer/bookings'
            )
          }
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar-outline"
            size={21}
            color="#FF6B35"
          />

          <Text
            style={
              styles.checkBookingsText
            }
          >
            Check Your Bookings & Status
          </Text>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#FF6B35"
          />
        </TouchableOpacity>

        <View
          style={styles.bottomSpace}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8F9FA',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },

  backToDashboardButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  backToDashboardText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  headerSpacer: {
    width: 40,
  },

  /* CONTENT */

  content: {
    flex: 1,
  },

  /* SAINT */

  saintCard: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 8,
  },

  saintInfo: {
    flexDirection: 'row',
  },

  saintAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  saintDetails: {
    flex: 1,
  },

  saintName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },

  saintLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },

  saintRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  /* SECTIONS */

  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },

  sectionDescription: {
    fontSize: 14,
    color: '#777',
    lineHeight: 20,
    marginBottom: 16,
  },

  /* POOJA */

  poojaCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },

  poojaName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  poojaDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },

  poojaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },

  metaText: {
    fontSize: 14,
    color: '#666',
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
  },

  priceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  priceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },

  /* DATE & TIME */

  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  dateTimeInfo: {
    flex: 1,
    marginLeft: 12,
  },

  dateTimeLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 3,
  },

  dateTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  /* CUSTOMER INPUTS */

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    gap: 12,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },

  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  /* TOTAL */

  totalSection: {
    padding: 20,
    marginBottom: 8,
  },

  totalCard: {
    backgroundColor: '#FFF5F0',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },

  totalCardLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },

  totalCardValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B35',
  },

  commissionText: {
    fontSize: 12,
    color: '#777',
    marginTop: 8,
  },

  /* PAYMENT */

  bookButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    gap: 8,
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  bookButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },

  /* CHECK BOOKINGS */

  checkBookingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    borderRadius: 12,
    height: 52,
    marginHorizontal: 20,
    marginTop: -8,
    marginBottom: 4,
    paddingHorizontal: 16,
  },

  checkBookingsText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#FF6B35',
  },

  bottomSpace: {
    height: 30,
  },
});
