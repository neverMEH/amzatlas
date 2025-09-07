#!/usr/bin/env npx tsx

async function debugCredentials() {
  console.log('🔍 Debugging BigQuery credentials format...\n')
  
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  
  if (!credsJson) {
    console.log('❌ GOOGLE_APPLICATION_CREDENTIALS_JSON is not set')
    return
  }
  
  console.log(`Credentials length: ${credsJson.length} characters\n`)
  
  // Try to parse the JSON
  try {
    const parsed = JSON.parse(credsJson)
    console.log('✅ Valid JSON format')
    console.log('\nCredentials structure:')
    console.log(`  type: ${parsed.type}`)
    console.log(`  project_id: ${parsed.project_id}`)
    console.log(`  private_key_id: ${parsed.private_key_id}`)
    console.log(`  client_email: ${parsed.client_email}`)
    console.log(`  client_id: ${parsed.client_id}`)
    console.log(`  auth_uri: ${parsed.auth_uri}`)
    console.log(`  token_uri: ${parsed.token_uri}`)
    console.log(`  auth_provider_x509_cert_url: ${parsed.auth_provider_x509_cert_url}`)
    console.log(`  client_x509_cert_url: ${parsed.client_x509_cert_url}`)
    console.log(`  universe_domain: ${parsed.universe_domain}`)
    
    // Check private key
    if (parsed.private_key) {
      console.log('\n✅ Private key exists')
      console.log(`  Length: ${parsed.private_key.length} characters`)
      
      // Check format
      const hasBegin = parsed.private_key.includes('-----BEGIN PRIVATE KEY-----')
      const hasEnd = parsed.private_key.includes('-----END PRIVATE KEY-----')
      const hasNewlines = parsed.private_key.includes('\\n')
      const hasActualNewlines = parsed.private_key.includes('\n')
      
      console.log(`  Has BEGIN marker: ${hasBegin ? '✅' : '❌'}`)
      console.log(`  Has END marker: ${hasEnd ? '✅' : '❌'}`)
      console.log(`  Has \\\\n escapes: ${hasNewlines ? '✅' : '❌'}`)
      console.log(`  Has actual newlines: ${hasActualNewlines ? '❌ (should be escaped)' : '✅'}`)
      
      // Show first and last parts
      const keyStart = parsed.private_key.substring(0, 50)
      const keyEnd = parsed.private_key.substring(parsed.private_key.length - 50)
      console.log(`\n  Key start: ${keyStart}...`)
      console.log(`  Key end: ...${keyEnd}`)
      
      // Create properly formatted version
      if (!hasNewlines && hasActualNewlines) {
        console.log('\n⚠️  Key has actual newlines instead of \\\\n escapes')
        console.log('Creating corrected version...')
        
        const corrected = JSON.stringify(parsed)
        console.log('\nCorrected credentials (copy this to your env var):')
        console.log('----------------------------------------')
        console.log(corrected)
        console.log('----------------------------------------')
      }
    } else {
      console.log('\n❌ Private key is missing!')
    }
    
  } catch (error: any) {
    console.log('❌ Invalid JSON format')
    console.log(`Error: ${error.message}`)
    
    // Try to identify the issue
    if (credsJson.includes('\n') || credsJson.includes('\r') || credsJson.includes('\t')) {
      console.log('\n⚠️  Credentials contain unescaped whitespace characters')
      console.log('Attempting to clean and reformat...')
      
      try {
        // Remove actual newlines, tabs, and carriage returns
        const cleaned = credsJson
          .replace(/[\r\n\t]/g, '')
          .trim()
        
        const parsed = JSON.parse(cleaned)
        const reformatted = JSON.stringify(parsed)
        
        console.log('\nCleaned credentials (copy this to your env var):')
        console.log('----------------------------------------')
        console.log(reformatted)
        console.log('----------------------------------------')
      } catch (cleanError) {
        console.log('❌ Failed to clean credentials:', cleanError.message)
      }
    }
  }
}

debugCredentials().catch(console.error)