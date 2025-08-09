import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, CircularProgress, Paper } from '@mui/material';
import { Vendor, VendorCard } from '../components/VendorCard';
import { VendorSelectionPanel } from '../components/VendorSelectionPanel';
import { useParams } from 'react-router-dom';
import { Step as AppStep } from '../App';

interface Artifact {
  artifact_id: string;
  content: any;
  created_at: string;
  artifact_type: string;
}

interface Step extends AppStep {
  model_output_artifact_id?: string;
}

interface TimelineEvent {
  timestamp: number;
  event_type: string;
  data: any;
}

interface TimelineEvent {
  timestamp: number;
  event_type: string;
  data: any;
}

export const DemoPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<Step | null>(null);
  const [artifacts, setArtifacts] = useState<Record<string, Artifact>>({});
  const { runId } = useParams<{ runId: string }>();

  // Load vendors data
  useEffect(() => {
    const loadVendors = async () => {
      try {
        const response = await fetch('/vendor_dataset_1000.json');
        const data = await response.json();
        setVendors(data);
      } catch (error) {
        console.error('Error loading vendors:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVendors();
  }, []);

  // Load run data if runId is present
  useEffect(() => {
    if (!runId) return;

    const loadRunData = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}/timeline`);
        const data = await response.json();
        setTimelineEvents(data.events);
        
        // Process steps and artifacts from the timeline
        const steps = data.steps || [];
        const artifactsMap: Record<string, Artifact> = {};
        
        // Process artifacts if available
        if (data.artifacts) {
          data.artifacts.forEach((artifact: Artifact) => {
            artifactsMap[artifact.artifact_id] = artifact;
          });
        }
        
        setArtifacts(artifactsMap);
        
        // Set the first step as current if available
        if (steps.length > 0) {
          setCurrentStep(steps[0]);
        }
      } catch (error) {
        console.error('Error loading run data:', error);
      }
    };

    loadRunData();
  }, [runId]);

  const handleVendorSelect = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    // Here you could add analytics or additional logic when a vendor is selected
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Vendor Selection Demo
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        {/* Left panel - Vendor selection */}
        <Box sx={{ width: { xs: '100%', md: '33%' } }}>
          <VendorSelectionPanel
            vendors={vendors}
            onSelectVendor={handleVendorSelect}
            selectedVendor={selectedVendor}
          />
        </Box>
        
        {/* Right panel - Visualization and details */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 3, mb: 3, minHeight: '300px' }}>
            <Typography variant="h6" gutterBottom>
              Agent Decision Process
            </Typography>
            
            {currentStep && (
              <Box>
                <Typography variant="subtitle1">
                  Current Step: {currentStep.step_name}
                </Typography>
                {currentStep.model_output_artifact_id && artifacts[currentStep.model_output_artifact_id] && (
                  <Box mt={2} p={2} bgcolor="#f5f5f5" borderRadius={1}>
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(
                        artifacts[currentStep.model_output_artifact_id]?.content,
                        null,
                        2
                      )}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
          
          {selectedVendor && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Selected Vendor Details
              </Typography>
              <VendorCard vendor={selectedVendor} />
            </Paper>
          )}
        </Box>
      </Box>
    </Container>
  );
};

export default DemoPage;
